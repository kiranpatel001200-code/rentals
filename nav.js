/* Adds "Messages" with an unread count to the header when someone is logged in.
   The count comes from the database, so it is still there after a refresh or on another device. */
(function(){
  var nav = document.getElementById("nav"); if(!nav) return;
  var URL_ = "https://abppfpgazlngdhrejrog.supabase.co", KEY = "sb_publishable_aDiJt8SXRag8hD73rhiFuQ_ezmlGWo5";
  var css = document.createElement("style");
  css.textContent = ".mbadge{display:inline-block;min-width:20px;padding:0 6px;margin-left:6px;border-radius:99px;background:#d93025;color:#fff;font:700 .75rem/20px system-ui,sans-serif;text-align:center;vertical-align:middle}.mbadge.hide{display:none!important}";
  document.head.appendChild(css);
  function ready(cb){
    if(window.supabase && window.supabase.createClient) return cb();
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"; s.onload = cb; document.head.appendChild(s);
  }
  ready(async function(){
    var client = (window.sb && window.sb.auth) ? window.sb : window.supabase.createClient(URL_, KEY);
    var s = await client.auth.getSession(); if(!s.data.session) return;
    var link = document.createElement("a"); link.href = "messages.html"; link.id = "navMsg"; link.appendChild(document.createTextNode("Messages"));
    var badge = document.createElement("span"); badge.className = "mbadge hide"; link.appendChild(badge);
    if(location.pathname.split("/").pop() === "messages.html"){ link.className = "on"; }
    nav.insertBefore(link, nav.querySelector("a.pill") || null);
    async function refresh(){
      try{
        var r = await client.rpc("my_unread_count"); var n = typeof r.data === "number" ? r.data : 0;
        badge.textContent = n > 99 ? "99+" : String(n); badge.className = "mbadge" + (n > 0 ? "" : " hide");
        link.setAttribute("aria-label", n > 0 ? "Messages, " + n + " unread" : "Messages");
      }catch(e){}
    }
    refresh(); setInterval(refresh, 60000);
    window.addEventListener("focus", refresh); window.addEventListener("rn:unread", refresh);
    document.addEventListener("visibilitychange", function(){ if(!document.hidden){ refresh(); } });
  });
})();
