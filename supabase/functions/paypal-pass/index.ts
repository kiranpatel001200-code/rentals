import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "https://kiranpatel001200-code.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Contact Pass prices. Landlords pay one price, renters another. Change them with the secrets
// PASS_PRICE_LANDLORD and PASS_PRICE_RENTER (and PASS_DAYS for how long a pass lasts).
const PRICE_LANDLORD = Deno.env.get("PASS_PRICE_LANDLORD") ?? "17.99";
const PRICE_RENTER = "25.00";
const DAYS = parseInt(Deno.env.get("PASS_DAYS") ?? "365", 10);
const BASE = Deno.env.get("PAYPAL_ENV") === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

async function paypalToken(): Promise<string> {
  const id = Deno.env.get("PAYPAL_CLIENT_ID");
  const secret = Deno.env.get("PAYPAL_SECRET");
  if (!id || !secret) throw new Error("PayPal is not switched on yet.");
  const r = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${id}:${secret}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const d = await r.json();
  if (!r.ok) throw new Error("Could not connect to PayPal.");
  return d.access_token as string;
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: u, error: ue } = await supa.auth.getUser();
    if (ue || !u.user) return json({ error: "Please log in first." }, 401);
    const user = u.user;
    const body = await req.json().catch(() => ({}));
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // The price depends on the account type chosen at signup: renters pay the renter price, everybody else the landlord price.
    const { data: prof } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const PRICE = prof?.role === "renter" ? PRICE_RENTER : PRICE_LANDLORD;

    // Public, authenticated quote used by the renter popup so its displayed price matches checkout.
    if (body.action === "config") {
      if (!prof?.role || !["renter", "landlord"].includes(prof.role)) {
        return json({ error: "This plan is not available for your account." }, 403);
      }
      return json({ price: PRICE, days: DAYS, client_id: Deno.env.get("PAYPAL_CLIENT_ID") ?? "" });
    }

    // Gate 1: the email must be verified. Gate 2: no payment while a pass is still active.
    async function eligibility(): Promise<Response | null> {
      if (!user.email_confirmed_at) return json({ error: "Please verify your email address first." }, 403);
      const { data: reason } = await admin.rpc("can_buy_pass", { p_uid: user.id });
      if (reason === "not_verified") return json({ error: "Please verify your email address first." }, 403);
      if (reason === "already_active") {
        const { data: cp } = await admin.from("contact_passes").select("expires_at").eq("user_id", user.id).maybeSingle();
        return json({ error: "You already have an active Contact Pass" + (cp?.expires_at ? ` until ${fmt(cp.expires_at)}` : "") + ". You can buy a new one after it expires." }, 409);
      }
      if (reason) return json({ error: "This payment is not available for your account." }, 403);
      return null;
    }

    if (body.action === "create") {
      const blocked = await eligibility();
      if (blocked) return blocked;
      const at = await paypalToken();
      const r = await fetch(`${BASE}/v2/checkout/orders`, {
        method: "POST",
        headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{ description: prof?.role === "renter" ? "RenterHere Renter Premium - 1 year" : "RenterHere Landlord Contact Pass - 1 year", custom_id: user.id, amount: { currency_code: "USD", value: PRICE } }],
        }),
      });
      const d = await r.json();
      if (!r.ok) return json({ error: "Could not start the payment." }, 502);
      return json({ id: d.id });
    }

    if (body.action === "capture") {
      const orderId = String(body.orderID ?? "");
      if (!/^[A-Z0-9]{10,30}$/i.test(orderId)) return json({ error: "Invalid order." }, 400);

      const { data: used } = await admin.from("pass_payments").select("order_id,user_id").eq("order_id", orderId).maybeSingle();
      if (used) return used.user_id === user.id ? json({ ok: true }) : json({ error: "This payment was already used." }, 409);

      // Checked again before any money is taken.
      const blocked = await eligibility();
      if (blocked) return blocked;

      const at = await paypalToken();
      const r = await fetch(`${BASE}/v2/checkout/orders/${orderId}/capture`, {
        method: "POST",
        headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" },
      });
      const d = await r.json();
      const unit = d?.purchase_units?.[0];
      const cap = unit?.payments?.captures?.[0];
      if (!r.ok || d.status !== "COMPLETED" || !cap || cap.status !== "COMPLETED") return json({ error: "The payment was not completed." }, 402);
      const owner = cap.custom_id ?? unit?.custom_id;
      if (cap.amount?.currency_code !== "USD" || Number(cap.amount?.value) !== Number(PRICE) || owner !== user.id) {
        return json({ error: "The payment did not match this account." }, 402);
      }

      const payer = d?.payer ?? {};
      const source = d?.payment_source ?? {};
      const card = source.card ?? {};
      const paypalWallet = source.paypal ?? {};
      const breakdown = cap.seller_receivable_breakdown ?? {};
      const fee = Number(breakdown.paypal_fee?.value);
      const net = Number(breakdown.net_amount?.value);
      const paymentMethod = card.last_digits ? "card" : (Object.keys(paypalWallet).length ? "paypal" : "unknown");
      const { error: pe } = await admin.from("pass_payments").insert({
        order_id: orderId,
        user_id: user.id,
        amount: Number(cap.amount.value),
        currency: "USD",
        paypal_capture_id: cap.id,
        paypal_payer_id: payer.payer_id ?? null,
        payer_name: [payer.name?.given_name, payer.name?.surname].filter(Boolean).join(" ") || card.name || null,
        payer_email: payer.email_address ?? null,
        payment_method: paymentMethod,
        card_brand: card.brand ?? null,
        card_last4: /^\\d{2,4}$/.test(String(card.last_digits ?? "")) ? String(card.last_digits) : null,
        paypal_fee_amount: Number.isFinite(fee) ? fee : null,
        paypal_net_amount: Number.isFinite(net) ? net : null,
        paypal_environment: Deno.env.get("PAYPAL_ENV") === "live" ? "live" : "sandbox",
        account_role: prof?.role === "renter" ? "renter" : "landlord",
      });
      if (pe) return json({ error: "Could not record the payment. Please contact support." }, 500);

      // A new pass only starts when there is no active one, so it always runs from today.
      const exp = new Date(Date.now() + DAYS * 86400000).toISOString();
      const { error: ge } = await admin.from("contact_passes").upsert({ user_id: user.id, granted_at: new Date().toISOString(), expires_at: exp, source: "paypal" });
      if (ge) return json({ error: "Payment received but the pass could not be saved. Please contact support." }, 500);
      return json({ ok: true, expires_at: exp });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    return json({ error: (e as Error).message || "Something went wrong." }, 500);
  }
});
