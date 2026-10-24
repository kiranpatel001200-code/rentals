import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
const cors = { "Access-Control-Allow-Origin": "https://kiranpatel001200-code.github.io", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), resend = Deno.env.get("RESEND_API_KEY"), sender = Deno.env.get("RESEND_FROM");
  if (!url || !key || !resend || !sender) return reply({ error: "Welcome email service is not fully configured." }, 503);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return reply({ error: "Sign in required" }, 401);
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: ud, error: ue } = await db.auth.getUser(token);
  if (ue || !ud.user || !ud.user.email_confirmed_at) return reply({ error: "Verified account required" }, 403);
  const { data: claimed, error: ce } = await db.rpc("claim_welcome_email", { p_user_id: ud.user.id });
  if (ce) return reply({ error: "Could not claim welcome email" }, 500);
  if (!claimed || !claimed.length) { const { data } = await db.from("welcome_email_queue").select("status").eq("user_id", ud.user.id).maybeSingle(); return reply({ status: data?.status || "not_queued", already_processed: true }); }
  const item = claimed[0], first = (item.full_name || item.email.split("@")[0]).trim().split(/\s+/)[0];
  const esc = (s: string) => s.replace(/[&<>"\x27]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "\x27": "&#39;" } as Record<string,string>)[c] || c);
  const subject = "Welcome to RentNest — your next chapter starts here";
  const html = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#1b2a41"><header style="padding:28px;background:#0b2a5b;color:white"><h1>RentNest</h1><p>Better Homes. Happier Lives.</p></header><main style="padding:28px"><h2>Welcome aboard, ' + esc(first) + '!</h2><p>Thanks for joining RentNest. We’re glad you’re here.</p><p>Whether you’re searching for a place to call home or sharing a property, our goal is to make your rental journey clearer, simpler, and more welcoming.</p><p style="padding:16px;background:#eef4ff;border-radius:10px"><b>Your account is verified and ready.</b><br>Your RentNest User ID: ' + esc(item.user_id) + '</p><p>Thanks for being part of our growing community. Here’s to finding your next place with less stress and more confidence.</p><p>Warmly,<br><b>The RentNest Team</b></p><a href="https://kiranpatel001200-code.github.io/rentals/" style="display:inline-block;padding:12px 18px;background:#1769e8;color:white;text-decoration:none;border-radius:8px">Explore RentNest</a></main></div>';
  const text = "Welcome to RentNest, " + first + "!\n\nThanks for joining RentNest. We’re glad you’re here. Whether you’re searching for a place to call home or sharing a property, our goal is to make your rental journey clearer, simpler, and more welcoming.\n\nYour account is verified and ready. RentNest User ID: " + item.user_id + "\n\nThanks for being part of our growing community.\n\nWarmly, The RentNest Team\nhttps://kiranpatel001200-code.github.io/rentals/";
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "Authorization": "Bearer " + resend, "Content-Type": "application/json", "Idempotency-Key": "rentnest-welcome-" + item.user_id }, body: JSON.stringify({ from: sender, to: [item.email], subject, html, text }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) { await db.from("welcome_email_queue").update({ status: "failed", last_error: String(result.message || result.name || "Provider error").slice(0,500), updated_at: new Date().toISOString() }).eq("id", item.id); return reply({ error: "Welcome email could not be sent", details: result.message || result.name }, 502); }
  await db.from("welcome_email_queue").update({ status: "sent", sent_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq("id", item.id);
  await db.from("user_activity_logs").insert({ user_id: item.user_id, event_type: "welcome_email_sent", entity_type: "profile", entity_id: item.user_id, details: { provider: "resend", email_id: result.id || null } });
  return reply({ status: "sent", email_id: result.id || null });
});