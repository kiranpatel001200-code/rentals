/* Contact Pass settings. Keep the price text in sync with the PASS_PRICE / PASS_DAYS secrets of the paypal-pass function.
   Put your PayPal Client ID (it is public, it is safe here) in clientId. Leave it empty to keep payment switched off. */
var PASS = { price: "$4.99", term: "one payment, valid for 1 year", clientId: "" };

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
    d.appendChild(passEl("b", "", "Renter Contact Pass"));
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
    buildPay(d, onDone);
  });
  return d;
}
function buildPay(d, onDone){
  d.appendChild(passEl("p", "", "Unlock contact details for up to 3 different rental listings during this pass period. " + PASS.price + ", " + PASS.term + ". If you need more than 3 listings, contact RentNest to discuss a bigger premium offer."));
  var fine = passEl("p", "passfine", "All purchases are final and non-refundable. The pass does not renew automatically. By paying you agree to the ");
  var ta = passEl("a", "", "Terms of Service"); ta.href = "terms.html"; ta.target = "_blank"; fine.appendChild(ta); fine.appendChild(document.createTextNode("."));
  d.appendChild(fine);
  var note = passEl("p", "passnote"); var holder = passEl("div", "ppbtn");
  d.appendChild(holder); d.appendChild(note);
  if(!PASS.clientId){
    var b = passEl("button", "", "Get Renter Contact Pass (" + PASS.price + ")"); b.type = "button";
    b.onclick = function(){ note.textContent = "Online payment is not switched on yet. It will be available soon."; };
    holder.appendChild(b); return;
  }
  function draw(){
    paypal.Buttons({
      style: { layout: "vertical", shape: "rect", label: "pay" },
      createOrder: async function(){ note.textContent = ""; var r = await passCall({ action: "create" }); return r.id; },
      onApprove: async function(data){
        note.textContent = "Confirming your payment...";
        try{ var r = await passCall({ action: "capture", orderID: data.orderID });
          note.textContent = "Payment received. Your Renter Contact Pass is active" + (r && r.expires_at ? " until " + passDate(r.expires_at) : "") + ".";
          if(onDone){ setTimeout(onDone, 1200); } }
        catch(e){ note.textContent = e.message; }
      },
      onError: function(err){ note.textContent = (err && err.message && err.message.indexOf("already have") !== -1) ? err.message : "The payment could not be completed. Please try again."; }
    }).render(holder);
  }
  if(window.paypal){ draw(); }
  else {
    var s = document.createElement("script");
    s.src = "https://www.paypal.com/sdk/js?client-id=" + encodeURIComponent(PASS.clientId) + "&currency=USD&intent=capture&components=buttons";
    s.onload = draw; s.onerror = function(){ note.textContent = "Could not load PayPal. Please try again."; };
    document.head.appendChild(s);
  }
}
