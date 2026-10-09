/* Contact Pass settings. Keep the price text in sync with the PASS_PRICE / PASS_DAYS secrets of the paypal-pass function.
   Put your PayPal Client ID (it is public, it is safe here) in clientId. Leave it empty to keep payment switched off. */
var PASS = { price: "$4.99", term: "one payment, valid for 1 year", clientId: "" };

function passEl(tag, cls, text){ var e = document.createElement(tag); if(cls) e.className = cls; if(text !== undefined) e.textContent = text; return e; }
async function passCall(body){
  var r = await sb.functions.invoke("paypal-pass", { body: body });
  if(r.error){
    var m = "Something went wrong. Please try again.";
    try{ var j = await r.error.context.json(); if(j && j.error){ m = j.error; } }catch(e){}
    throw new Error(m);
  }
  return r.data;
}
function passBox(onDone){
  var d = passEl("div", "pass");
  d.appendChild(passEl("b", "", "Contact Pass"));
  d.appendChild(passEl("p", "", "See phone numbers and emails in your messages and on listings. " + PASS.price + ", " + PASS.term + ". Unlimited contacts, no extra payment for each message or listing."));
  var note = passEl("p", "passnote"); var holder = passEl("div", "ppbtn");
  d.appendChild(holder); d.appendChild(note);
  if(!PASS.clientId){
    var b = passEl("button", "", "Get Contact Pass (" + PASS.price + ")"); b.type = "button";
    b.onclick = function(){ note.textContent = "Online payment is not switched on yet. It will be available soon."; };
    holder.appendChild(b); return d;
  }
  function draw(){
    paypal.Buttons({
      style: { layout: "vertical", shape: "rect", label: "pay" },
      createOrder: async function(){ note.textContent = ""; var r = await passCall({ action: "create" }); return r.id; },
      onApprove: async function(data){
        note.textContent = "Confirming your payment...";
        try{ await passCall({ action: "capture", orderID: data.orderID }); note.textContent = "Payment received. Your Contact Pass is active."; if(onDone){ setTimeout(onDone, 900); } }
        catch(e){ note.textContent = e.message; }
      },
      onError: function(){ note.textContent = "The payment could not be completed. Please try again."; }
    }).render(holder);
  }
  if(window.paypal){ draw(); }
  else {
    var s = document.createElement("script");
    s.src = "https://www.paypal.com/sdk/js?client-id=" + encodeURIComponent(PASS.clientId) + "&currency=USD&intent=capture&components=buttons";
    s.onload = draw; s.onerror = function(){ note.textContent = "Could not load PayPal. Please try again."; };
    document.head.appendChild(s);
  }
  return d;
}
