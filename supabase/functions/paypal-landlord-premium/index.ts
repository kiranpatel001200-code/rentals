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
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    // Administrator-only payment management. The browser never receives PayPal credentials.
    if (action === "admin_list" || action === "admin_refund") {
      if (!profile || profile.role !== "admin") return json({ error: "Administrator access required." }, 403);
      if (action === "admin_list") {
        const [landlordResult, renterResult, listingResult] = await Promise.all([
          admin.from("payments")
            .select("id,user_id,payment_type,subscription_id,paypal_order_id,paypal_capture_id,amount,currency,status,created_at,payer_name,payer_email,paypal_payer_id,payment_method,card_brand,card_last4,paypal_fee_amount,paypal_net_amount,paypal_environment,account_role,refund_status,refunded_amount,paypal_refund_id,refund_note,refunded_at,profiles!payments_user_id_fkey(full_name,email,user_code,role,is_banned)")
            .eq("payment_type", "subscription")
            .in("status", ["completed", "refunded"])
            .not("paypal_capture_id", "is", null)
            .order("created_at", { ascending: false }).limit(200),
          admin.from("pass_payments")
            .select("order_id,user_id,amount,currency,created_at,paypal_capture_id,paypal_payer_id,payer_name,payer_email,payment_method,card_brand,card_last4,paypal_fee_amount,paypal_net_amount,paypal_environment,account_role,profiles!pass_payments_user_id_fkey(full_name,email,user_code,role,is_banned)")
            .not("paypal_capture_id", "is", null)
            .order("created_at", { ascending: false }).limit(200),
          admin.from("listing_premium_orders")
            .select("id,listing_id,user_id,paypal_order_id,paypal_capture_id,amount,currency,status,created_at,completed_at,expires_at,paypal_payer_id,payer_name,payer_email,payment_method,card_brand,card_last4,paypal_fee_amount,paypal_net_amount,paypal_environment,account_role,profiles!listing_premium_orders_user_id_fkey(full_name,email,user_code,role,is_banned),listings!listing_premium_orders_listing_id_fkey(title,city,state)")
            .in("status", ["completed", "refunded"])
            .not("paypal_capture_id", "is", null)
            .order("created_at", { ascending: false }).limit(200),
        ]);
        if (landlordResult.error || renterResult.error || listingResult.error) {
          console.error("Admin payment report query failed:", landlordResult.error?.message, renterResult.error?.message, listingResult.error?.message);
          throw new Error("Could not load all PayPal payment records. Check payment audit columns and admin permissions.");
        }
        const landlordPayments = (landlordResult.data ?? []).map((row: any) => ({
          ...row,
          purchase_type: "Landlord Premium",
          account_role: row.account_role ?? "landlord",
        }));
        const renterPayments = (renterResult.data ?? []).map((row: any) => ({
          ...row,
          id: "pass-" + row.order_id,
          paypal_order_id: row.order_id,
          payment_type: "contact_pass",
          subscription_id: null,
          status: "completed",
          refund_status: "none",
          refunded_amount: 0,
          purchase_type: row.account_role === "landlord" ? "Landlord Contact Pass" : "Renter Contact Pass",
          account_role: row.account_role ?? row.profiles?.role ?? "renter",
        }));
        const listingPayments = (listingResult.data ?? []).map((row: any) => ({
          ...row,
          payment_type: "listing_premium",
          subscription_id: null,
          refund_status: "none",
          refunded_amount: 0,
          purchase_type: "Listing Premium",
          listing_title: row.listings?.title ?? null,
          listing_location: [row.listings?.city, row.listings?.state].filter(Boolean).join(", "),
          account_role: row.account_role ?? row.profiles?.role ?? "landlord",
        }));
        const payments = [...landlordPayments, ...renterPayments, ...listingPayments]
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 500);
        return json({ ok: true, environment: isLive ? "live" : "sandbox", total: payments.length, payments });
      }

      const paymentId = String(body.payment_id ?? "");
      const note = String(body.note ?? "").trim().slice(0, 500);
      const requested = Number(body.amount);
      if (!/^[0-9a-f-]{36}$/i.test(paymentId) || !Number.isFinite(requested) || requested <= 0) {
        return json({ error: "Choose a valid payment and refund amount." }, 400);
      }
      const { data: payment, error: paymentError } = await admin.from("payments")
        .select("id,user_id,payment_type,subscription_id,paypal_capture_id,amount,currency,status,refund_status,refund_request_id,refunded_amount")
        .eq("id", paymentId).maybeSingle();
      if (paymentError || !payment) return json({ error: "Payment record was not found." }, 404);
      if (payment.payment_type !== "subscription" || payment.status !== "completed" || !payment.paypal_capture_id) {
        return json({ error: "Only completed PayPal Premium payments can be refunded here." }, 409);
      }
      if (payment.refund_status === "completed") return json({ error: "This payment has already been fully refunded." }, 409);
      if (payment.refund_status === "pending") return json({ error: "A refund request is already pending. Check PayPal before trying again." }, 409);
      const remaining = Math.round((Number(payment.amount) - Number(payment.refunded_amount || 0)) * 100) / 100;
      const refundAmount = Math.round(requested * 100) / 100;
      if (refundAmount > remaining || refundAmount <= 0) return json({ error: "Refund amount exceeds the remaining captured amount." }, 400);

      const requestId = crypto.randomUUID(); // Every distinct partial/full refund gets its own idempotency key.
      const { data: locked, error: lockError } = await admin.from("payments")
        .update({ refund_status: "pending", refund_request_id: requestId, refund_note: note || null, refund_error: null })
        .eq("id", paymentId).eq("refund_status", payment.refund_status)
        .select("id").maybeSingle();
      if (lockError || !locked) return json({ error: "This payment is already being processed. Refresh the dashboard." }, 409);

      const token = await paypalToken();
      let refund: any;
      try {
        const response = await fetch(PAYPAL_BASE + "/v2/payments/captures/" + encodeURIComponent(payment.paypal_capture_id) + "/refund", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
            "PayPal-Request-Id": requestId,
          },
          body: JSON.stringify({
            amount: { value: refundAmount.toFixed(2), currency_code: payment.currency },
            ...(note ? { note_to_payer: note } : {}),
          }),
        });
        refund = await response.json().catch(() => ({}));
        if (!response.ok) {
          const issue = Array.isArray(refund.details) ? refund.details[0]?.issue : null;
          await admin.from("payments").update({ refund_status: "failed", refund_error: issue || "PayPal rejected the refund request." }).eq("id", paymentId).eq("refund_request_id", requestId);
          return json({ error: issue ? "PayPal could not issue the refund (" + issue + ")." : "PayPal could not issue the refund. Check PayPal activity." }, 502);
        }
      } catch (_networkError) {
        // Keep the request pending: PayPal may have received it even if the connection dropped.
        return json({ error: "Refund result is not yet confirmed. Check PayPal activity before retrying.", pending: true }, 202);
      }

      if (!refund?.id || !["COMPLETED", "PENDING"].includes(String(refund.status || ""))) {
        await admin.from("payments").update({ refund_status: "pending", refund_error: "PayPal refund status is not final. Verify in PayPal." }).eq("id", paymentId).eq("refund_request_id", requestId);
        return json({ error: "PayPal accepted or is processing the request, but the final refund status is not confirmed yet.", pending: true }, 202);
      }
      if (refund.status === "PENDING") {
        await admin.from("payments").update({ refund_status: "pending", paypal_refund_id: refund.id, refund_error: "PayPal is processing this refund." }).eq("id", paymentId).eq("refund_request_id", requestId);
        return json({ ok: true, pending: true, refund_id: refund.id });
      }

      const totalRefunded = Math.round((Number(payment.refunded_amount || 0) + refundAmount) * 100) / 100;
      const fullyRefunded = totalRefunded >= Number(payment.amount);
      const { error: saveError } = await admin.from("payments").update({
        refunded_amount: totalRefunded,
        refund_status: fullyRefunded ? "completed" : "none",
        status: fullyRefunded ? "refunded" : "completed",
        paypal_refund_id: refund.id,
        refund_error: null,
        refunded_at: new Date().toISOString(),
      }).eq("id", paymentId).eq("refund_request_id", requestId);
      if (saveError) return json({ error: "PayPal refunded the payment, but RenterHere could not save the result. Keep PayPal refund ID " + refund.id + " for reconciliation." }, 500);

      if (fullyRefunded && payment.subscription_id) {
        const { count } = await admin.from("payments").select("id", { count: "exact", head: true })
          .eq("subscription_id", payment.subscription_id).eq("status", "completed");
        if (!count || count === 0) {
          await admin.from("landlord_subscriptions").update({ status: "cancelled", current_period_end: new Date().toISOString(), cancel_at_period_end: false })
            .eq("id", payment.subscription_id);
        }
      }
      await admin.from("admin_audit_logs").insert({
        admin_id: user.id, action: "paypal_premium_refund",
        target_table: "payments", target_id: paymentId,
        details: { refund_id: refund.id, amount: refundAmount, currency: payment.currency, fully_refunded: fullyRefunded, note: note || null },
      });
      return json({ ok: true, refund_id: refund.id, refunded_amount: totalRefunded, fully_refunded: fullyRefunded });
    }

    if (!profile || profile.role !== "landlord") return json({ error: "Landlord accounts only can buy Landlord Premium." }, 403);
    if (profile.is_banned) return json({ error: "This account cannot make purchases. Contact support." }, 403);

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
        account_role: profile.role,
        paypal_environment: isLive ? "live" : "sandbox",
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
      let orderDetails: any = order;
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
        orderDetails = capturedOrder;
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

      const payer = orderDetails.payer ?? {};
      const source = orderDetails.payment_source ?? {};
      const card = source.card ?? {};
      const paypalSource = source.paypal ?? {};
      const breakdown = capture.seller_receivable_breakdown ?? {};
      const fee = Number(breakdown.paypal_fee?.value);
      const net = Number(breakdown.net_amount?.value);
      const paymentMethod = card.last_digits ? "card" : (Object.keys(paypalSource).length ? "paypal" : "unknown");
      const { error: metadataError } = await admin.from("payments").update({
        paypal_payer_id: payer.payer_id ?? null,
        payer_name: [payer.name?.given_name, payer.name?.surname].filter(Boolean).join(" ") || card.name || null,
        payer_email: payer.email_address ?? null,
        payment_method: paymentMethod,
        card_brand: card.brand ?? null,
        card_last4: /^\d{4}$/.test(String(card.last_digits ?? "")) ? String(card.last_digits) : null,
        paypal_fee_amount: Number.isFinite(fee) ? fee : null,
        paypal_net_amount: Number.isFinite(net) ? net : null,
        account_role: profile.role,
        paypal_environment: isLive ? "live" : "sandbox",
      }).eq("paypal_order_id", orderId).eq("user_id", user.id);
      if (metadataError) console.error("Payment metadata could not be saved:", metadataError.message);

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
