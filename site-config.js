/* Fill these in once. They appear on the Privacy Policy and Terms of Service pages.
   email: the address people can write to for support and privacy requests.
   state: the U.S. state whose laws govern the Terms (for example "California"). */
var SITE_CONFIG = { email: "", state: "" };
(function(){
  function fill(sel, value, mail){
    document.querySelectorAll(sel).forEach(function(e){
      if(!value){ e.textContent = "[add this in site-config.js]"; e.className += " ph"; return; }
      if(mail){ var a = document.createElement("a"); a.href = "mailto:" + value; a.textContent = value; e.textContent = ""; e.appendChild(a); }
      else { e.textContent = value; }
    });
  }
  fill(".cfg-email", SITE_CONFIG.email, true);
  fill(".cfg-state", SITE_CONFIG.state, false);
})();
