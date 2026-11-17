(function(){
  if (window.renterHerePaymentToast) return;
  window.renterHerePaymentToast = function(title, detail){
    var old = document.getElementById("renterHerePaymentToast");
    if(old) old.remove();
    var toast = document.createElement("div");
    toast.id = "renterHerePaymentToast";
    toast.setAttribute("role","status");
    toast.setAttribute("aria-live","polite");
    toast.style.cssText = "position:fixed;z-index:99999;top:18px;right:18px;width:min(390px,calc(100vw - 28px));background:#fff;border:1px solid #b9e5cc;border-left:5px solid #16834a;border-radius:14px;padding:15px 17px;box-shadow:0 14px 40px rgba(8,35,28,.2);color:#17342d;font:500 14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;display:flex;gap:12px;align-items:flex-start;animation:rhToastIn .22s ease-out";
    var icon = document.createElement("span");
    icon.textContent = "✓";
    icon.style.cssText = "display:grid;place-items:center;flex:0 0 26px;width:26px;height:26px;border-radius:50%;background:#e6f6ed;color:#08743c;font-weight:800;font-size:17px";
    var copy = document.createElement("div");
    var heading = document.createElement("strong");
    heading.textContent = title || "Payment successful";
    heading.style.cssText = "display:block;font-size:15px;color:#0e5135;margin-bottom:2px";
    var detailText = document.createElement("span");
    detailText.textContent = detail || "Your PayPal payment has been confirmed.";
    copy.appendChild(heading);
    copy.appendChild(detailText);
    toast.appendChild(icon);
    toast.appendChild(copy);
    if(!document.getElementById("rhToastStyle")){
      var style = document.createElement("style");
      style.id = "rhToastStyle";
      style.textContent = "@keyframes rhToastIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}";
      document.head.appendChild(style);
    }
    document.body.appendChild(toast);
    window.setTimeout(function(){
      if(document.getElementById("renterHerePaymentToast") === toast){
        toast.style.transition = "opacity .25s ease";
        toast.style.opacity = "0";
        window.setTimeout(function(){ toast.remove(); },280);
      }
    },6500);
  };
})();