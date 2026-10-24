import { createClient } from "npm:@supabase/supabase-js@2";

const RECIPIENT = "kiranpatel001200@gmail.com";
const ALLOWED_ORIGINS = new Set(["https://kiranpatel001200-code.github.io"]);
const TOPICS = new Set(["Renting a home", "Listing a property", "Premium contact upgrade", "Report a listing", "Other"]);
const json = (body: unknown, status = 200, origin = "") => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": origin || "https://kiranpatel001200-code.github.io",
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, idempotency-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  },
});
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const validUuid = (s: unknown) => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://kiranpatel001200-code.github.io",
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, idempotency-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  }});
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin not allowed" }, 403, origin);
  if (!origin) return json({ error: "Browser origin required" }, 403, origin);

  try {
    const raw = await req.json();
    const fullName = typeof raw.full_name === "string" ? raw.full_name.trim() : "";
    const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
    const topic = typeof raw.topic === "string" ? raw.topic : "";
    const message = typeof raw.message === "string" ? raw.message.trim() : "";
    const submissionId = raw.submission_id;

    if (fullName.length < 2 || fullName.length > 100 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
        !TOPICS.has(topic) || message.length < 10 || message.length > 2000 ||
        !validUuid(submissionId)) {
      return json({ error: "Please check the name, email, topic, and message." }, 400, origin);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRoleKey) return json({ error: "Contact service is not configured." }, 503, origin);
    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const forwarded = req.headers.get("cf-connecting-ip") ||
      (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
      req.headers.get("x-real-ip") || "";
    const rateLimitIdentity = forwarded ? "ip:" + forwarded : "email:" + email;
    const ipHash = await sha256(rateLimitIdentity);
    const { data: allowed, error: rateError } = await admin.rpc("consume_contact_form_rate_limit", { p_ip_hash: ipHash });
    if (rateError) return json({ error: "Contact service could not check the request limit." }, 503, origin);
    if (allowed !== true) return json({ error: "Too many contact requests. Please try again in 15 minutes." }, 429, origin);

    let userId: string | null = null;
    const authHeader = req.headers.get("authorization") || "";
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (tokenMatch) {
      const { data } = await admin.auth.getUser(tokenMatch[1]);
      if (data.user) userId = data.user.id;
    }

    let requestRow: Record<string, unknown> | null = null;
    const { data: existing, error: lookupError } = await admin
      .from("support_requests")
      .select("id,user_id,full_name,email,topic,message,status,created_at,email_notification_status,email_notification_attempts,email_notification_claimed_at")
      .eq("client_submission_id", submissionId)
      .maybeSingle();
    if (lookupError) return json({ error: "Could not load your existing submission." }, 503, origin);

    if (existing && existing.email_notification_status === "sent") {
      return json({ saved: true, notified: true, duplicate: true, email_status: "sent" }, 200, origin);
    }
    if (existing && existing.email_notification_status === "sending" &&
        existing.email_notification_claimed_at &&
        Date.now() - new Date(existing.email_notification_claimed_at).getTime() < 3 * 60 * 1000) {
      return json({ saved: true, notified: false, duplicate: true, email_status: "sending" }, 202, origin);
    }

    if (existing) {
      const nextAttempt = Number(existing.email_notification_attempts || 0) + 1;
      const { data: claimed, error } = await admin.from("support_requests")
        .update({
          email_notification_status: "sending",
          email_notification_claimed_at: new Date().toISOString(),
          email_notification_attempts: nextAttempt,
          email_notification_error: null,
        })
        .eq("id", existing.id)
        .select("id,user_id,full_name,email,topic,message,status,created_at,email_notification_attempts")
        .single();
      if (error || !claimed) return json({ error: "Could not retry your saved request." }, 503, origin);
      requestRow = claimed;
    } else {
      const { data: inserted, error } = await admin.from("support_requests")
        .insert({
          client_submission_id: submissionId,
          user_id: userId,
          full_name: fullName,
          email,
          topic,
          message,
          status: "new",
          email_notification_status: "sending",
          email_notification_attempts: 1,
          email_notification_claimed_at: new Date().toISOString(),
        })
        .select("id,user_id,full_name,email,topic,message,status,created_at,email_notification_attempts")
        .single();
      if (error || !inserted) {
        if (error?.code === "23505") return json({ saved: true, notified: false, duplicate: true, email_status: "pending" }, 202, origin);
        return json({ error: "Could not save your contact request." }, 503, origin);
      }
      requestRow = inserted;
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      await admin.from("support_requests").update({
        email_notification_status: "failed",
        email_notification_error: "RESEND_API_KEY is not configured in Supabase Edge Function secrets.",
      }).eq("id", requestRow.id);
      return json({ saved: true, notified: false, email_status: "failed", message: "Your request was saved, but email notification is not configured yet." }, 202, origin);
    }

    const sender = Deno.env.get("RESEND_FROM") || "RentNest <onboarding@resend.dev>";
    const subject = "[RentNest Contact Us] " + String(requestRow.topic);
    const details = [
      "New Contact Us request received on RentNest.",
      "",
      "Name: " + requestRow.full_name,
      "Email: " + requestRow.email,
      "Topic: " + requestRow.topic,
      "Submitted: " + requestRow.created_at,
      "Request ID: " + requestRow.id,
      "",
      "Message:",
      String(requestRow.message),
      "",
      "Open the RentNest Admin page to review support requests.",
    ].join("\n");
    const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#1b2a41;line-height:1.6">
      <h2 style="color:#0b2a5b">New RentNest Contact Us request</h2>
      <p>A visitor submitted a new request through the Contact Us page.</p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;border-bottom:1px solid #dbe6f6;color:#5b6b82">Name</td><td style="padding:8px;border-bottom:1px solid #dbe6f6"><b>${esc(String(requestRow.full_name))}</b></td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #dbe6f6;color:#5b6b82">Email</td><td style="padding:8px;border-bottom:1px solid #dbe6f6"><a href="mailto:${esc(String(requestRow.email))}">${esc(String(requestRow.email))}</a></td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #dbe6f6;color:#5b6b82">Topic</td><td style="padding:8px;border-bottom:1px solid #dbe6f6">${esc(String(requestRow.topic))}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #dbe6f6;color:#5b6b82">Request ID</td><td style="padding:8px;border-bottom:1px solid #dbe6f6">${esc(String(requestRow.id))}</td></tr>
      </table>
      <h3 style="color:#0b2a5b">Message</h3>
      <div style="white-space:pre-wrap;background:#f4f8ff;border:1px solid #dbe6f6;border-radius:10px;padding:16px">${esc(String(requestRow.message))}</div>
      <p style="font-size:13px;color:#5b6b82">This is an automated notification from RentNest.</p>
    </div>`;

    const send = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + resendKey,
        "Content-Type": "application/json",
        "Idempotency-Key": "rentnest-contact-" + submissionId,
      },
      body: JSON.stringify({
        from: sender,
        to: [RECIPIENT],
        reply_to: [String(requestRow.email)],
        subject,
        text: details,
        html,
      }),
    });

    if (!send.ok) {
      const providerBody = await send.text().catch(() => "");
      const reason = "Email provider returned HTTP " + send.status + (providerBody ? ": " + providerBody.slice(0, 350) : "");
      await admin.from("support_requests").update({
        email_notification_status: "failed",
        email_notification_error: reason.slice(0, 1000),
      }).eq("id", requestRow.id);
      return json({ saved: true, notified: false, email_status: "failed", message: "Your request was saved, but the email could not be sent. You can retry this form." }, 202, origin);
    }

    await admin.from("support_requests").update({
      email_notification_status: "sent",
      email_notification_sent_at: new Date().toISOString(),
      email_notification_error: null,
      email_notification_claimed_at: null,
    }).eq("id", requestRow.id);

    return json({ saved: true, notified: true, email_status: "sent" }, 200, origin);
  } catch (_error) {
    return json({ error: "Unexpected contact service error. Please retry." }, 500, req.headers.get("origin") || "");
  }
});
