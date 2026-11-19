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
      if(quote && quote.environment){ PASS.environment = quote.environment; }
    }catch(e){
      d.appendChild(passEl("p", "passnote", e.message || "Could not load the Premium price. Please refresh and try again."));
      return;
    }
    buildPay(d, onDone, role);
  });
  return d;
}
function buildPay(d, onDone, role){
  var price = passEl("p", "pass-plan-price");
  price.appendChild(document.createTextNode(PASS.price + " USD "));
  price.appendChild(passEl("small", "", "/ year"));
  d.appendChild(price);
  d.appendChild(passEl("p", "pass-plan-intro", "One secure payment for " + PASS.term + ". No automatic renewal. Your Renter Premium access starts after PayPal confirms the payment."));
  var benefits = passEl("ul", "pass-plan-benefits");
  ["Unlock landlord phone numbers when provided","View landlord email and WhatsApp details when available","Get up to 3 distinct listing contact leads per pass period","Use the pass while searching across available rental listings","No automatic renewal — one-time payment"].forEach(function(item){ benefits.appendChild(passEl("li", "", item)); });
  d.appendChild(benefits);
  d.appendChild(passEl("p", "passfine", "Need more than 3 contact leads? Contact RenterHere about additional access."));

  var continueButton = passEl("button", "main", "Continue to secure checkout — " + PASS.price + "/year");
  continueButton.type = "button";
  continueButton.style.cssText = "margin-top:14px;min-height:48px;padding:12px 22px;border-radius:12px;background:var(--blue);color:#fff;font-weight:700";
  d.appendChild(continueButton);
  d.appendChild(passEl("p", "passfine", "Choose PayPal or Debit/Credit Card in the secure checkout popup."));
  var modal = null, sdkPromise = null, paymentUiReady = false;

  function note(message, kind){
    var el = modal && modal.querySelector("#renterPassCheckoutMessage");
    if(el){ el.textContent = message || ""; el.className = "note" + (kind ? " " + kind : ""); }
  }
  function closeModal(){
    if(!modal) return;
    modal.classList.add("hide");
    document.body.style.overflow = "";
  }
  function createModal(){
    if(modal) return modal;
    modal = passEl("div", "rh-checkout-overlay hide");
    modal.id = "renterPassCheckoutModal";
    modal.setAttribute("role","dialog");
    modal.setAttribute("aria-modal","true");
    modal.setAttribute("aria-labelledby","renterPassCheckoutTitle");
    var dialog = passEl("div","rh-checkout-dialog");
    var head = passEl("div","rh-checkout-head");
    var heading = passEl("div","");
    heading.appendChild(passEl("span","rh-checkout-kicker","RENTERHERE SECURE CHECKOUT"));
    var title = passEl("h2","", "Complete your Renter Premium purchase");
    title.id = "renterPassCheckoutTitle";
    heading.appendChild(title);
    var close = passEl("button","rh-checkout-close","×");
    close.type = "button"; close.setAttribute("aria-label","Close checkout");
    close.onclick = closeModal;
    head.appendChild(heading); head.appendChild(close); dialog.appendChild(head);

    var total = passEl("div","rh-checkout-total");
    var totalText = passEl("div","");
    totalText.appendChild(passEl("b","","Renter Premium"));
    totalText.appendChild(passEl("span","","One-time payment · " + PASS.term + " · No automatic renewal"));
    total.appendChild(totalText);
    var amount = passEl("strong", "", PASS.price + " ");
    amount.appendChild(passEl("small","","USD"));
    total.appendChild(amount); dialog.appendChild(total);
    dialog.appendChild(passEl("p","rh-checkout-safe","🔒 Choose PayPal or Debit/Credit Card. PayPal securely processes card details; RenterHere never receives or stores your card number or CVV."));

    var terms = passEl("label","pass-consent");
    terms.style.cssText = "display:flex;align-items:flex-start;gap:9px;margin:8px 0;padding:10px 12px;border:1px solid #cbd8e8;border-radius:10px;background:#f5f8fd;color:#172b4d;font-size:13px;line-height:1.45";
    var checkbox = document.createElement("input");
    checkbox.type="checkbox"; checkbox.style.cssText="margin-top:3px;min-width:16px";
    terms.appendChild(checkbox);
    var consentCopy=passEl("span","pass-consent-copy");
    consentCopy.appendChild(document.createTextNode("I agree to the "));
    var link=passEl("a","","Terms of Service"); link.href="terms.html"; link.target="_blank"; link.rel="noopener";
    consentCopy.appendChild(link);
    consentCopy.appendChild(document.createTextNode(" and understand this is a one-time payment with no automatic renewal."));
    terms.appendChild(consentCopy);
    dialog.appendChild(terms);

    var choices=passEl("div","rh-payment-choices");
    var paypal=passEl("section","rh-payment-choice");
    paypal.appendChild(passEl("h3","","Pay with PayPal"));
    var paypalSlot=passEl("div","rh-paypal-button-slot"); paypalSlot.id="renterPassPayPalButton";
    paypal.appendChild(paypalSlot);
    var card=passEl("section","rh-payment-choice");
    card.appendChild(passEl("h3","","Pay with Debit or Credit Card"));
    card.appendChild(passEl("p","rh-card-hint","Pay securely through PayPal. A PayPal account is not required when guest card checkout is available."));
    var cardSlot=passEl("div","rh-paypal-button-slot"); cardSlot.id="renterPassCardButton";
    card.appendChild(cardSlot);
    var cardMessage=passEl("p","rh-card-hint",""); cardMessage.id="renterPassCardMessage"; card.appendChild(cardMessage);
    choices.appendChild(paypal); choices.appendChild(card); dialog.appendChild(choices);
    dialog.appendChild(passEl("p","rh-checkout-foot","No automatic renewal. Contact Pass is separate from Landlord Premium."));
    var message=passEl("p","note",""); message.id="renterPassCheckoutMessage"; message.setAttribute("role","status"); message.setAttribute("aria-live","polite");
    dialog.appendChild(message); modal.appendChild(dialog);
    modal.addEventListener("click",function(event){if(event.target===modal) closeModal();});
    document.addEventListener("keydown",function(event){if(event.key==="Escape" && !modal.classList.contains("hide")) closeModal();});
    document.body.appendChild(modal);
    checkbox.addEventListener("change",function(){ if(checkbox.checked && !paymentUiReady) initialise(); });
    modal._checkbox=checkbox;
    return modal;
  }
  async function loadSdk(config){
    if(sdkPromise) return sdkPromise;
    if(window.paypal && typeof window.paypal.Buttons==="function" && window.paypal.FUNDING){
      sdkPromise=Promise.resolve(); return sdkPromise;
    }
    sdkPromise=new Promise(function(resolve,reject){
      var script=document.querySelector('script[data-rh-renter-paypal="1"]');
      var settled=false, timeoutId;
      function finish(error){
        if(settled) return;
        settled=true;
        if(timeoutId) clearTimeout(timeoutId);
        if(error){ sdkPromise=null; reject(error); }
        else if(window.paypal && typeof window.paypal.Buttons==="function" && window.paypal.FUNDING){ resolve(); }
        else { sdkPromise=null; reject(new Error("PayPal loaded but its checkout buttons were unavailable. Please retry.")); }
      }
      if(!script){
        script=document.createElement("script");
        script.dataset.rhRenterPaypal="1";
        var params="client-id="+encodeURIComponent(config.client_id)+"&components=buttons&enable-funding=card&currency=USD&intent=capture&locale=en_US";
        if(config.environment!=="live") params+="&buyer-country=US";
        script.src="https://www.paypal.com/sdk/js?"+params;
        script.async=true;
        script.onload=function(){ finish(); };
        script.onerror=function(){ finish(new Error("PayPal's secure checkout service could not be reached. Check the connection and tap Continue to retry.")); };
        document.head.appendChild(script);
      }else{
        script.addEventListener("load",function(){ finish(); },{once:true});
        script.addEventListener("error",function(){ finish(new Error("PayPal's secure checkout service could not be reached. Check the connection and tap Continue to retry.")); },{once:true});
        if(window.paypal && typeof window.paypal.Buttons==="function") finish();
      }
      timeoutId=setTimeout(function(){
        finish(new Error("PayPal is taking too long to respond. Check your connection and tap Continue to retry."));
      },20000);
    });
    return sdkPromise;
  }
  async function createOrder(){
    note("Preparing your secure payment...");
    var result=await passCall({action:"create"});
    if(!result || !result.id) throw new Error("Could not create the PayPal order.");
    note(""); return result.id;
  }
  async function capture(data){
    var orderID=data && data.orderID;
    if(!orderID) throw new Error("PayPal did not return a payment order ID.");
    note("Verifying your payment and activating Renter Premium...");
    var result=await passCall({action:"capture",orderID:orderID});
    if(!result || result.ok!==true) throw new Error("Payment verification is still pending. Please contact support.");
    var expiry=result.expires_at ? " until " + passDate(result.expires_at) : "";
    note("Payment successful! Your Renter Premium is active" + expiry + ".","ok");
    if(window.renterHerePaymentToast) window.renterHerePaymentToast("Payment successful","PayPal confirmed your Renter Premium" + expiry + ".");
    closeModal();
    if(onDone) setTimeout(onDone,900);
    return result;
  }
  async function initialise(){
    if(paymentUiReady) return;
    note("Loading secure payment options...");
    try{
      if(!PASS.clientId) throw new Error("PayPal checkout is not configured for this account yet.");
      await loadSdk({client_id:PASS.clientId,environment:PASS.environment||"sandbox"});
      var common={style:{layout:"vertical",shape:"rect",height:48,label:"pay"},onClick:function(data,actions){if(!modal._checkbox.checked){note("Please agree to the Terms of Service before paying.","err");return actions.reject();}return actions.resolve();},createOrder:createOrder,onApprove:capture,onCancel:function(){note("Payment canceled. You can try again.");},onError:function(error){console.error("Renter Premium PayPal error:",error);note("PayPal could not complete checkout. Please try again.","err");}};
      var paypalSlot=modal.querySelector("#renterPassPayPalButton");
      var cardSlot=modal.querySelector("#renterPassCardButton");
      var paypalButton=window.paypal.Buttons(Object.assign({},common,{fundingSource:window.paypal.FUNDING.PAYPAL}));
      if(paypalButton.isEligible()) await paypalButton.render("#renterPassPayPalButton");
      else paypalSlot.textContent="PayPal checkout is not available for this buyer or merchant account.";
      var cardButton=window.paypal.Buttons(Object.assign({},common,{fundingSource:window.paypal.FUNDING.CARD,style:{layout:"vertical",shape:"rect",height:48,label:"pay",color:"black"}}));
      if(cardButton.isEligible()){
        await cardButton.render("#renterPassCardButton");
        modal.querySelector("#renterPassCardMessage").textContent="Card payments are securely processed by PayPal.";
      }else{
        modal.querySelector("#renterPassCardMessage").textContent="Guest card checkout is not currently enabled for this PayPal merchant account. You can still use PayPal.";
        cardSlot.textContent="Debit/Credit Card checkout is not currently eligible.";
      }
      paymentUiReady=true; note("");
    }catch(error){ console.error("Renter Premium checkout initialization:",error); note(error.message || "Could not load secure checkout.","err"); }
  }
  continueButton.onclick=function(){
    createModal();
    modal.classList.remove("hide");
    document.body.style.overflow="hidden";
    if(!paymentUiReady) initialise();
    modal.querySelector(".rh-checkout-close").focus();
  };
}
