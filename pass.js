/* Contact Pass settings. Keep the price text in sync with the PASS_PRICE / PASS_DAYS secrets of the paypal-pass function.
   Put your PayPal Client ID (it is public, it is safe here) in clientId. Leave it empty to keep payment switched off. */
var PASS = { price: "$25.00", term: "one payment, valid for 1 year", clientId: "" };

function passEl(tag, cls, text){ var e = document.createElement(tag); if(cls) e.className = cls; if(text !== undefined) e.textContent = text; return e; }
function passDate(d){ return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); }
async function passInfo(){
  try{
    var r = await sb.rpc("my_pass_info"); var d = r.data && r.data[0];
    return d ? { active: d.active === true, expires: d.expires_at, ever: d.ever_had === true } : { active: false, expires: null, ever: false };
  }catch(e){ return { active: false, expires: null, ever: false }; }
}
function passStatusText(i){
  if(i.active) return i.expires ? "Contact Pass active until " + passDate(i.expires) + "." : "Contact Pass active (no end date).";
  if(i.ever && i.expires) return "Your Contact Pass expired on " + passDate(i.expires) + ".";
  return "No active Contact Pass.";
}
async function passCall(body){
  var r = await sb.functions.invoke("paypal-pass", { body: body });
  if(r.error){
    var m = "Something went wrong. Please try again.";
    try{ var j = await r.error.context.json(); if(j && j.error){ m = j.error; } }catch(e){}
    throw new Error(m);
  }
  return r.data;
}
/* The payment box. A user who already has an active pass never sees a payment button,
   and the pay button only appears again after the pass has expired. */
function passBox(onDone){
  var d = passEl("div", "pass");
  d.appendChild(passEl("p", "passfine", "Checking your Contact Pass..."));
  Promise.all([passInfo(), sb.auth.getSession()]).then(async function(r){
    var info = r[0], session = r[1].data.session; d.textContent = "";
    d.appendChild(passEl("b", "", "Renter Premium"));
    var profileResult = session ? await sb.from("profiles").select("role").eq("id", session.user.id).maybeSingle() : null;
    var role = profileResult && profileResult.data ? profileResult.data.role : null;
    if(session && role === "landlord"){
      d.appendChild(passEl("p", "passfine", "Landlord premium only covers your own landlord features. The Renter Contact Pass is a separate add-on that you can purchase on this account to unlock up to 3 other listings' contact details."));
    }
    if(session && role === "admin"){
      d.appendChild(passEl("p", "", "Admin accounts can review listing contacts without purchasing a renter pass."));
      return;
    }
    if(info.active){
      var usageResult = await sb.rpc("my_contact_usage");
      var used = usageResult.error ? 0 : Math.max(0, Number(usageResult.data) || 0);
      d.appendChild(passEl("p", "", passStatusText(info) + " This pass includes up to 3 different listing contact details. Used: " + Math.min(used, 3) + "/3. You do not need to pay again while it is active."));
      if(used >= 3){ var more = passEl("a", "", "Contact us for a bigger premium offer"); more.href = "contact.html?topic=premium-upgrade"; d.appendChild(more); }
      return;
    }
    if(!session){
      d.appendChild(passEl("p", "", "Log in to buy a Contact Pass."));
      var lg = passEl("a", "", "Log in or sign up"); lg.href = "login.html"; d.appendChild(lg); return;
    }
    if(info.ever && info.expires){ d.appendChild(passEl("p", "passfine", "Your last pass expired on " + passDate(info.expires) + ".")); }
    try{
      var quote = await passCall({ action: "config" });
      if(quote && quote.price){ PASS.price = "$" + Number(quote.price).toFixed(2); }
      if(quote && quote.days){ PASS.term = "one payment, valid for " + Number(quote.days) + " days"; }
      if(quote && quote.client_id){ PASS.clientId = quote.client_id; }
    }catch(e){
      d.appendChild(passEl("p", "passnote", e.message || "Could not load the Premium price. Please refresh and try again."));
      return;
    }
    buildPay(d, onDone);
  });
  return d;
}
function buildPay(d, onDone){
  d.appendChild(passEl("p", "", "Unlock the landlord's phone, email and WhatsApp details when provided, for up to 3 different rental listings. " + PASS.price + " USD for 1 year, as a one-time payment. No automatic renewal. Need more than 3 contact leads? Contact RenterHere about additional access."));
  var fine = passEl("p", "passfine", "Contact Pass purchases are strictly non-refundable once unlocked, subject to applicable law. The pass does not renew automatically. By paying you agree to the ");
  var termsLink = passEl("a", "", "Terms of Service");
  termsLink.href = "terms.html";
  termsLink.target = "_blank";
  termsLink.rel = "noopener";
  fine.appendChild(termsLink);
  fine.appendChild(document.createTextNode("."));
  d.appendChild(fine);

  var consentLine = passEl("label", "pass-consent");
  consentLine.style.cssText = "display:flex;align-items:flex-start;gap:10px;margin:14px 0;padding:12px 14px;border:1px solid #cbd8e8;border-radius:10px;background:#f5f8fd;color:#172b4d;font-size:14px;line-height:1.5;cursor:pointer;";
  var consent = document.createElement("input");
  consent.type = "checkbox";
  consent.required = true;
  consent.setAttribute("aria-label", "I agree to the Terms of Service and understand that Contact Pass purchases are strictly non-refundable once unlocked.");
  consent.style.cssText = "width:18px;height:18px;min-width:18px;margin:2px 0 0;accent-color:#155fc0;cursor:pointer;";
  consentLine.appendChild(consent);
  consentLine.appendChild(document.createTextNode("I agree to the "));
  consentLine.appendChild(termsLink.cloneNode(true));
  consentLine.appendChild(document.createTextNode(" and understand that Contact Pass purchases are strictly non-refundable once unlocked."));
  d.appendChild(consentLine);

  var holder = passEl("div", "ppbtn");
  holder.style.display = "none";
  var note = passEl("p", "passnote", "Please tick the checkbox above to enable PayPal checkout.");
  d.appendChild(holder);
  d.appendChild(note);

  var rendered = false;
  var loading = false;
  var fallbackAdded = false;

  function renderPaypal(){
    if(!consent.checked || rendered || !window.paypal) return;
    rendered = true;
    var buttons = paypal.Buttons({
      style: { layout: "vertical", shape: "rect", label: "pay" },
      onClick: function(data, actions){
        if(!consent.checked){
          note.textContent = "Please agree to the Terms of Service before paying.";
          return actions.reject();
        }
        note.textContent = "";
        return actions.resolve();
      },
      createOrder: async function(){
        if(!consent.checked) throw new Error("Please agree to the Terms of Service before paying.");
        note.textContent = "";
        var r = await passCall({ action: "create" });
        return r.id;
      },
      onApprove: async function(data){
        note.textContent = "Confirming your payment...";
        try{
          var r = await passCall({ action: "capture", orderID: data.orderID });
          note.textContent = "Payment received. Your Renter Premium is active" + (r && r.expires_at ? " until " + passDate(r.expires_at) : "") + ".";
          if(onDone){ setTimeout(onDone, 1200); }
        }catch(e){ note.textContent = e.message; }
      },
      onError: function(err){
        note.textContent = (err && err.message && err.message.indexOf("already have") !== -1) ? err.message : "The payment could not be completed. Please try again.";
      }
    });
    var renderResult = buttons.render(holder);
    if(renderResult && typeof renderResult.catch === "function"){
      renderResult.catch(function(){
        rendered = false;
        note.textContent = "The payment button could not be loaded. Please try again.";
      });
    }
  }

  function enableCheckout(){
    if(!consent.checked) return;
    holder.style.display = "";
    note.textContent = "";
    if(!PASS.clientId){
      if(!fallbackAdded){
        var b = passEl("button", "", "Get Renter Premium (" + PASS.price + ")");
        b.type = "button";
        b.onclick = function(){ note.textContent = "Online payment is not switched on yet. It will be available soon."; };
        holder.appendChild(b);
        fallbackAdded = true;
      }
      return;
    }
    if(window.paypal){ renderPaypal(); return; }
    if(loading) return;
    loading = true;
    var s = document.createElement("script");
    s.src = "https://www.paypal.com/sdk/js?client-id=" + encodeURIComponent(PASS.clientId) + "&currency=USD&intent=capture&components=buttons";
    s.onload = function(){ loading = false; renderPaypal(); };
    s.onerror = function(){ loading = false; note.textContent = "Could not load PayPal. Please try again."; };
    document.head.appendChild(s);
  }

  consent.addEventListener("change", function(){
    if(consent.checked){
      enableCheckout();
    }else{
      holder.style.display = "none";
      note.textContent = "Please tick the checkbox above to enable PayPal checkout.";
    }
  });
}
