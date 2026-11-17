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

const PRICE = (Number(Deno.env.get("LISTING_PREMIUM_PRICE") ?? "35")).toFixed(2);
const TERM_DAYS = Math.max(1, Math.min(365, Number.parseInt(Deno.env.get("LISTING_PREMIUM_DAYS") ?? "365", 10) || 365));
const REFERENCE_ID = "renterhere-listing-premium";
const isLive = Deno.env.get("PAYPAL_ENV") === "live";
const PAYPAL_BASE = isLive ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

async function paypalToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID") ?? "";
  const secret = Deno.env.get("PAYPAL_SECRET") ?? "";
  if (!clientId || !secret) throw new Error("PayPal checkout is not configured yet.");
  const r = await fetch(PAYPAL_BASE + "/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(clientId + ":" + secret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new Error("Could not authenticate with PayPal. Please contact support.");
  return d.access_token as string;
}

async function paypalApi(path: string, token: string, method = "GET", body?: unknown) {
  const r = await fetch(PAYPAL_BASE + path, {
    method,
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const issue = Array.isArray(d.details) ? d.details[0]?.issue : null;
    throw new Error(issue ? "PayPal could not complete this request (" + issue + ")." : "PayPal request failed. Please try again.");
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
    if (!profile || !["renter", "landlord"].includes(profile.role)) {
      return json({ error: "A renter or landlord account is required." }, 403);
    }
    if (profile.is_banned) return json({ error: "This account cannot make purchases. Contact support." }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    if (action === "config") {
      if (!user.email_confirmed_at) return json({ error: "Please verify your email address first." }, 403);
      return json({
        ready: Boolean(Deno.env.get("PAYPAL_CLIENT_ID") && Deno.env.get("PAYPAL_SECRET")),
        client_id: Deno.env.get("PAYPAL_CLIENT_ID") ?? null,
        environment: isLive ? "live" : "sandbox",
        amount: PRICE,
        currency: "USD",
        days: TERM_DAYS,
      });
    }

    if (!user.email_confirmed_at) return json({ error: "Please verify your email address before purchasing." }, 403);
    const { data: blocked, error: blockedError } = await admin.rpc("is_blocked", { p_uid: user.id });
    if (blockedError) throw new Error("Could not verify account eligibility.");
    if (blocked === true) return json({ error: "This account cannot make purchases. Contact support." }, 403);

    if (action === "create") {
      const listingId = String(body.listing_id ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(listingId)) return json({ error: "Choose a valid listing." }, 400);

      const { data: listing, error: listingError } = await admin
        .from("listings")
        .select("id,title,status,deleted_at,landlord_id,premium_priority,premium_priority_until")
        .eq("id", listingId)
        .eq("landlord_id", user.id)
        .maybeSingle();
      if (listingError) throw new Error("Could not verify your listing.");
      if (!listing || listing.deleted_at || listing.status !== "approved") {
        return json({ error: "Only your live listing can be upgraded. Make it live first." }, 409);
      }
      if (listing.premium_priority && (!listing.premium_priority_until || new Date(listing.premium_priority_until).getTime() > Date.now())) {
        return json({ error: "This listing already has active Premium priority." }, 409);
      }

      // Supersede an abandoned checkout for this listing before creating a fresh order.
      const { error: cancelOldError } = await admin.from("listing_premium_orders")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("listing_id", listingId)
        .eq("user_id", user.id)
        .eq("status", "pending");
      if (cancelOldError) throw new Error("Could not close the previous pending checkout.");

      const { data: activeOrder, error: activeError } = await admin
        .from("listing_premium_orders")
        .select("id,expires_at,status")
        .eq("listing_id", listingId)
        .eq("user_id", user.id)
        .eq("status", "completed")
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (activeError) throw new Error("Could not check this listing's Premium status.");
      if (activeOrder) return json({ error: "Listing Premium is already active for this property." }, 409);

      const token = await paypalToken();
      const order = await paypalApi("/v2/checkout/orders", token, "POST", {
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: REFERENCE_ID,
          custom_id: listingId,
          invoice_id: "RH-LIST-" + crypto.randomUUID(),
          description: "RenterHere Listing Premium - " + TERM_DAYS + " days",
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

      const { error: saveError } = await admin.from("listing_premium_orders").insert({
        listing_id: listingId,
        user_id: user.id,
        paypal_order_id: order.id,
        amount: Number(PRICE),
        currency: "USD",
        status: "pending",
        term_days: TERM_DAYS,
        account_role: profile.role,
      });
      if (saveError) throw new Error("The payment order could not be saved. Contact support before retrying.");
      return json({ id: order.id });
    }

    if (action === "cancel") {
      const orderId = String(body.orderID ?? "");
      if (!/^[A-Z0-9-]{8,40}$/i.test(orderId)) return json({ error: "Invalid PayPal order." }, 400);
      const { data: cancelled, error: cancelError } = await admin.from("listing_premium_orders")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("paypal_order_id", orderId)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (cancelError) throw new Error("Could not update the canceled checkout.");
      return json({ ok: true, cancelled: Boolean(cancelled) });
    }

    if (action === "capture") {
      const orderId = String(body.orderID ?? "");
      if (!/^[A-Z0-9-]{8,40}$/i.test(orderId)) return json({ error: "Invalid PayPal order." }, 400);

      const { data: pending, error: pendingError } = await admin
        .from("listing_premium_orders")
        .select("id,listing_id,user_id,amount,currency,status,expires_at")
        .eq("paypal_order_id", orderId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (pendingError) throw new Error("Could not verify the pending payment.");
      if (!pending) return json({ error: "This PayPal order was not created for your account." }, 403);
      if (pending.status === "completed") {
        return json({ ok: true, already_completed: true, expires_at: pending.expires_at });
      }
      if (pending.status !== "pending" || Number(pending.amount) !== Number(PRICE) || pending.currency !== "USD") {
        return json({ error: "This payment is not in a payable state." }, 409);
      }

      // Re-check ownership and non-deleted state before taking payment; role may be renter or landlord.
      const { data: listing, error: listingError } = await admin
        .from("listings")
        .select("id,title,status,deleted_at,landlord_id")
        .eq("id", pending.listing_id)
        .eq("landlord_id", user.id)
        .maybeSingle();
      if (listingError) throw new Error("Could not recheck listing ownership.");
      if (!listing || listing.deleted_at) return json({ error: "This listing is no longer available for upgrade." }, 409);

      const token = await paypalToken();
      let order = await paypalApi("/v2/checkout/orders/" + encodeURIComponent(orderId), token);
      const findUnit = (value: any) => Array.isArray(value.purchase_units)
        ? value.purchase_units.find((item: any) => item.reference_id === REFERENCE_ID && item.custom_id === pending.listing_id)
        : null;
      let unit = findUnit(order);
      if (!unit || unit.amount?.currency_code !== "USD" || String(unit.amount?.value) !== PRICE) {
        return json({ error: "The PayPal order did not match this listing and amount." }, 402);
      }

      if (order.status !== "COMPLETED") {
        if (order.status !== "APPROVED") return json({ error: "Approve the PayPal payment before returning here." }, 409);
        order = await paypalApi("/v2/checkout/orders/" + encodeURIComponent(orderId) + "/capture", token, "POST", {});
        if (order.status !== "COMPLETED") return json({ error: "PayPal has not marked this payment as completed." }, 402);
        unit = findUnit(order);
      }
      const capture = unit?.payments?.captures?.find((item: any) => item.status === "COMPLETED");
      if (!capture?.id || capture.amount?.currency_code !== "USD" || String(capture.amount?.value) !== PRICE) {
        return json({ error: "The captured payment did not match the Listing Premium price." }, 402);
      }

      const payer = order.payer ?? {};
      const source = order.payment_source ?? {};
      const card = source.card ?? {};
      const paypalSource = source.paypal ?? {};
      const breakdown = capture.seller_receivable_breakdown ?? {};
      const fee = Number(breakdown.paypal_fee?.value);
      const net = Number(breakdown.net_amount?.value);
      const paymentMethod = card.last_digits ? "card" : (Object.keys(paypalSource).length ? "paypal" : "unknown");
      const { error: metadataError } = await admin.from("listing_premium_orders").update({
        paypal_payer_id: payer.payer_id ?? null,
        payer_name: [payer.name?.given_name, payer.name?.surname].filter(Boolean).join(" ") || card.name || null,
        payer_email: payer.email_address ?? null,
        payment_method: paymentMethod,
        card_brand: card.brand ?? null,
        card_last4: /^\d{4}$/.test(String(card.last_digits ?? "")) ? String(card.last_digits) : null,
        paypal_fee_amount: Number.isFinite(fee) ? fee : null,
        paypal_net_amount: Number.isFinite(net) ? net : null,
        paypal_environment: isLive ? "live" : "sandbox",
        updated_at: new Date().toISOString(),
      }).eq("id", pending.id).eq("user_id", user.id);
      if (metadataError) console.error("Listing Premium payment metadata could not be saved:", metadataError.message);

      const { data: expiry, error: activationError } = await admin.rpc("activate_listing_premium_payment", {
        p_order_id: orderId,
        p_capture_id: capture.id,
        p_amount: Number(PRICE),
      });
      if (activationError || !expiry) {
        console.error("Listing Premium activation error:", activationError?.message ?? "No expiry returned");
        return json({ error: "PayPal received the payment, but Premium activation needs support. Contact us with PayPal order ID " + orderId + "." }, 500);
      }

      return json({ ok: true, expires_at: expiry });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error("Listing Premium error:", error);
    return json({ error: error instanceof Error ? error.message : "Something went wrong. Please try again." }, 500);
  }
});
