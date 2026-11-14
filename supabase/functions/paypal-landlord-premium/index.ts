import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "https://kiranpatel001200-code.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const PRICE = "35.00";
const PLAN_SLUG = "landlord-premium-yearly";
const isLive = Deno.env.get("PAYPAL_ENV") === "live";
const PAYPAL_BASE = isLive ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

async function paypalToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID") ?? "";
  const secret = Deno.env.get("PAYPAL_SECRET") ?? "";
  if (!clientId || !secret) throw new Error("PayPal checkout is not configured yet. Add the PayPal REST app Client ID and Secret in Supabase Edge Function secrets.");
  const r = await fetch(PAYPAL_BASE + "/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(clientId + ":" + secret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new Error("Could not authenticate with PayPal. Check the REST app credentials and environment.");
  return d.access_token as string;
}

async function paypalApi(path: string, token: string, method = "GET", body?: unknown) {
  const r = await fetch(PAYPAL_BASE + path, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const issue = Array.isArray(d.details) ? d.details[0]?.issue : null;
    throw new Error(issue ? "PayPal could not complete this request (" + issue + ")." : "PayPal request failed. Please try again or contact support.");
  }
  return d;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Please log in first." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Supabase function secrets are incomplete.");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    const user = authData?.user;
    if (authError || !user) return json({ error: "Please log in first." }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role,is_banned")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw new Error("Could not verify the account profile.");
    if (!profile || profile.role !== "landlord") return json({ error: "Landlord accounts only can buy Landlord Premium." }, 403);
    if (profile.is_banned) return json({ error: "This account cannot make purchases. Contact support." }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    if (action === "config") {
      const clientId = Deno.env.get("PAYPAL_CLIENT_ID") ?? "";
      const secret = Deno.env.get("PAYPAL_SECRET") ?? "";
      return json({
        ready: Boolean(clientId && secret),
        client_id: clientId || null,
        environment: isLive ? "live" : "sandbox",
        amount: PRICE,
        currency: "USD",
      });
    }

    if (!user.email_confirmed_at) return json({ error: "Please verify your email address before purchasing." }, 403);

    const { data: blocked, error: blockedError } = await admin.rpc("is_blocked", { p_uid: user.id });
    if (blockedError) throw new Error("Could not verify account eligibility.");
    if (blocked === true) return json({ error: "This account cannot make purchases. Contact support." }, 403);

    const { data: plan, error: planError } = await admin
      .from("subscription_plans")
      .select("id")
      .eq("slug", PLAN_SLUG)
      .maybeSingle();
    if (planError || !plan) throw new Error("The annual Landlord Premium plan is not available yet.");

    if (action === "create") {
      const { data: active, error: activeError } = await admin
        .from("landlord_subscriptions")
        .select("id,current_period_end,status")
        .eq("landlord_id", user.id)
        .eq("plan_id", plan.id)
        .in("status", ["active", "trialing"])
        .order("current_period_start", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (activeError) throw new Error("Could not check the current Premium status.");
      if (active && (!active.current_period_end || new Date(active.current_period_end).getTime() > Date.now())) {
        return json({ error: "Your Landlord Premium is already active. You can renew after it expires." }, 409);
      }

      const token = await paypalToken();
      const order = await paypalApi("/v2/checkout/orders", token, "POST", {
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: PLAN_SLUG,
          custom_id: user.id,
          invoice_id: "RH-LP-" + crypto.randomUUID(),
          description: "RenterHere Landlord Premium - 1 year",
          amount: { currency_code: "USD", value: PRICE },
        }],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: "RenterHere",
              shipping_preference: "NO_SHIPPING",
              user_action: "PAY_NOW",
            },
          },
        },
      });
      if (!order.id) throw new Error("PayPal did not return a valid order.");

      const { error: pendingError } = await admin.from("payments").insert({
        user_id: user.id,
        payment_type: "subscription",
        paypal_order_id: order.id,
        amount: Number(PRICE),
        currency: "USD",
        status: "pending",
      });
      if (pendingError) throw new Error("The payment order could not be saved. Please contact support before trying again.");
      return json({ id: order.id });
    }

    if (action === "capture") {
      const orderId = String(body.orderID ?? "");
      if (!/^[A-Z0-9-]{8,40}$/i.test(orderId)) return json({ error: "Invalid PayPal order." }, 400);

      const { data: pending, error: pendingError } = await admin
        .from("payments")
        .select("id,user_id,amount,currency,status,subscription_id")
        .eq("paypal_order_id", orderId)
        .eq("user_id", user.id)
        .eq("payment_type", "subscription")
        .maybeSingle();
      if (pendingError) throw new Error("Could not verify the pending payment.");
      if (!pending) return json({ error: "This PayPal order was not created for your account." }, 403);
      if (pending.status === "completed" && pending.subscription_id) {
        const { data: existing } = await admin
          .from("landlord_subscriptions")
          .select("current_period_end")
          .eq("id", pending.subscription_id)
          .maybeSingle();
        return json({ ok: true, already_completed: true, expires_at: existing?.current_period_end ?? null });
      }
      if (pending.status !== "pending" || Number(pending.amount) !== 35 || pending.currency !== "USD") {
        return json({ error: "This payment is not in a payable state." }, 409);
      }

      const token = await paypalToken();
      const order = await paypalApi("/v2/checkout/orders/" + encodeURIComponent(orderId), token);
      const unit = Array.isArray(order.purchase_units)
        ? order.purchase_units.find((item: any) => item.reference_id === PLAN_SLUG && item.custom_id === user.id)
        : null;
      if (!unit || unit.amount?.currency_code !== "USD" || String(unit.amount?.value) !== PRICE) {
        return json({ error: "The PayPal order amount or account did not match this purchase." }, 402);
      }

      let capture = unit.payments?.captures?.find((item: any) => item.status === "COMPLETED");
      if (order.status !== "COMPLETED") {
        if (order.status !== "APPROVED") return json({ error: "Approve the PayPal payment before returning here." }, 409);
        const capturedOrder = await paypalApi(
          "/v2/checkout/orders/" + encodeURIComponent(orderId) + "/capture",
          token,
          "POST",
          {},
        );
        const capturedUnit = capturedOrder.purchase_units?.find((item: any) => item.reference_id === PLAN_SLUG && item.custom_id === user.id);
        capture = capturedUnit?.payments?.captures?.find((item: any) => item.status === "COMPLETED");
        if (capturedOrder.status !== "COMPLETED") return json({ error: "PayPal has not marked this payment as completed." }, 402);
      }
      if (!capture?.id || capture.amount?.currency_code !== "USD" || String(capture.amount?.value) !== PRICE) {
        return json({ error: "The captured payment did not match the $35.00 USD annual plan." }, 402);
      }

      const { data: subscriptionId, error: activationError } = await admin.rpc("activate_landlord_premium_payment", {
        p_user_id: user.id,
        p_order_id: orderId,
        p_capture_id: capture.id,
        p_amount: 35.00,
      });
      if (activationError || !subscriptionId) {
        console.error("Landlord Premium activation error:", activationError?.message ?? "No subscription id returned");
        return json({ error: "PayPal received the payment, but Premium activation needs support. Contact us and provide PayPal order ID " + orderId + "." }, 500);
      }

      const { data: subscription } = await admin
        .from("landlord_subscriptions")
        .select("current_period_end")
        .eq("id", subscriptionId)
        .maybeSingle();
      return json({ ok: true, expires_at: subscription?.current_period_end ?? null });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error("Landlord Premium error:", error);
    return json({ error: error instanceof Error ? error.message : "Something went wrong. Please try again." }, 500);
  }
});
