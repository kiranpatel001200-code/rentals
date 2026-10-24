/* Header: Messages link with an unread count. Also: a blocked account sees only a 404 page, everywhere. */
(function(){
  var URL_ = "https://abppfpgazlngdhrejrog.supabase.co", KEY = "sb_publishable_aDiJt8SXRag8hD73rhiFuQ_ezmlGWo5";
  function showPage(){ document.documentElement.style.display = ""; }
  function notFound(){
    try{ localStorage.setItem("rn_blk", "1"); }catch(e){}
    document.documentElement.style.display = "";
    document.documentElement.innerHTML = '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>404 Not Found</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#fff;color:#222;text-align:center}h1{font-size:4.5rem;margin:0}p{color:#666;margin:6px 0 0}</style></head><body><div><h1>404</h1><p>Page not found</p></div></body>';
  }
  var nav = document.getElementById("nav");
  var css = document.createElement("style");
  css.textContent = ".mbadge{display:inline-block;min-width:20px;padding:0 6px;margin-left:6px;border-radius:99px;background:#d93025;color:#fff;font:700 .75rem/20px system-ui,sans-serif;text-align:center;vertical-align:middle}.mbadge.hide{display:none!important}";
  document.head.appendChild(css);
  function ready(cb){
    if(window.supabase && window.supabase.createClient) return cb();
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"; s.onload = cb; s.onerror = showPage; document.head.appendChild(s);
  }
  ready(async function(){
    try{
      var client = (window.sb && window.sb.auth) ? window.sb : window.supabase.createClient(URL_, KEY);
      var s = await client.auth.getSession();
      if(!s.data.session){ try{ localStorage.removeItem("rn_blk"); }catch(e){} showPage(); return; }
      var b = await client.rpc("am_i_blocked");
      if(b.data === true){ notFound(); return; }
      try{ localStorage.removeItem("rn_blk"); }catch(e){}
      showPage();
      if(!nav) return;
      var link = document.createElement("a"); link.href = "messages.html"; link.id = "navMsg"; link.appendChild(document.createTextNode("Messages"));
      var badge = document.createElement("span"); badge.className = "mbadge hide"; link.appendChild(badge);
      if(location.pathname.split("/").pop() === "messages.html"){ link.className = "on"; }
      nav.insertBefore(link, nav.querySelector("a.pill") || null);
      var refresh = async function(){
        try{
          var r = await client.rpc("my_unread_count"); var n = typeof r.data === "number" ? r.data : 0;
          badge.textContent = n > 99 ? "99+" : String(n); badge.className = "mbadge" + (n > 0 ? "" : " hide");
          link.setAttribute("aria-label", n > 0 ? "Messages, " + n + " unread" : "Messages");
        }catch(e){}
      };
      refresh(); setInterval(refresh, 60000);
      window.addEventListener("focus", refresh); window.addEventListener("rn:unread", refresh);
      document.addEventListener("visibilitychange", function(){ if(!document.hidden){ refresh(); } });
    }catch(e){ showPage(); }
  });
})();
