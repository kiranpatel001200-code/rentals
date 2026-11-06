/* Header: Messages link with an unread count. Also: a blocked account sees only a 404 page, everywhere. */
(function(){
  var URL_ = "https://abppfpgazlngdhrejrog.supabase.co", KEY = "sb_publishable_aDiJt8SXRag8hD73rhiFuQ_ezmlGWo5";
  /* Premium popup: premium.js adds the Premium button to the header and opens the popup. */
  if(!window.openPremium && !document.getElementById("premJs")){ var pj = document.createElement("script"); pj.id = "premJs"; pj.src = "premium.js"; pj.defer = true; document.head.appendChild(pj); }
  function showPage(){ document.documentElement.style.display = ""; }
  function notFound(){
    try{ localStorage.setItem("rn_blk", "1"); }catch(e){}
    document.documentElement.style.display = "";
    document.documentElement.innerHTML = '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>404 Not Found</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#fff;color:#222;text-align:center}h1{font-size:4.5rem;margin:0}p{color:#666;margin:6px 0 0}</style></head><body><div><h1>404</h1><p>Page not found</p></div></body>';
  }

  /* Persistent mobile bottom navigation, shared across all primary app pages. */
  function addMobileNav(){
    if(document.getElementById("rnMobileNav")) return;
    var current = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    var items = [
      {href:"index.html",label:"Home",key:"home",paths:["","index.html"],icon:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'},
      {href:"messages.html",label:"Messages",key:"messages",paths:["messages.html"],icon:'<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/>'},
      {href:"account.html",label:"My Account",key:"account",paths:["account.html","login.html"],icon:'<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>'},
      {href:"my-listings.html",label:"My Listings",key:"listings",paths:["my-listings.html","create-listing.html"],icon:'<path d="M3 5h18M3 12h18M3 19h18"/><path d="M7 5v0M7 12v0M7 19v0"/>'}
    ];
    var bar=document.createElement("nav");
    bar.id="rnMobileNav";bar.className="rn-mobile-nav";bar.setAttribute("aria-label","Mobile navigation");
    items.forEach(function(item){
      var a=document.createElement("a");a.href=item.href;a.className="rn-mobile-item";
      if(item.paths.indexOf(current)>=0){a.classList.add("active");a.setAttribute("aria-current","page");}
      var svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
      svg.setAttribute("viewBox","0 0 24 24");svg.setAttribute("aria-hidden","true");
      svg.innerHTML=item.icon; a.appendChild(svg);
      var label=document.createElement("span");label.textContent=item.label;a.appendChild(label);
      if(item.key==="messages"){
        var b=document.createElement("span");b.className="rn-mobile-badge";b.id="rnMobileUnread";b.hidden=true;b.textContent="";a.appendChild(b);
      }
      bar.appendChild(a);
    });
    document.body.appendChild(bar);
  }
  var mobileCss=document.createElement("style");
  mobileCss.textContent=
    ".rn-mobile-nav{display:none!important}" +
    "@media(max-width:760px){body{padding-bottom:calc(76px + env(safe-area-inset-bottom,0px))!important}.rn-mobile-nav{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr));align-items:stretch;gap:2px;position:fixed;z-index:10000;left:0;right:0;bottom:0;width:100%;box-sizing:border-box;padding:7px 5px calc(7px + env(safe-area-inset-bottom,0px));background:rgba(255,255,255,.97);border-top:1px solid #e3e9e8;box-shadow:0 -5px 22px rgba(15,35,40,.09);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}.rn-mobile-item{position:relative;min-width:0;min-height:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:4px 1px;margin:0!important;border:0!important;border-radius:12px;text-decoration:none!important;color:#647477!important;font:600 10.5px/1.15 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;white-space:nowrap;-webkit-tap-highlight-color:transparent}.rn-mobile-item svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:0 0 auto}.rn-mobile-item.active{color:#08796d!important;background:#eaf6f3}.rn-mobile-item:focus-visible{outline:2px solid #08796d;outline-offset:-2px}.rn-mobile-badge{position:absolute;top:0;left:calc(50% + 5px);min-width:15px;height:15px;padding:0 3px;border-radius:99px;background:#d93025;color:#fff;font:700 9px/15px system-ui,sans-serif;text-align:center}.rn-mobile-badge[hidden]{display:none!important}}@media(max-width:360px){.rn-mobile-item{font-size:9.5px;gap:3px}.rn-mobile-item svg{width:19px;height:19px}.rn-mobile-nav{padding-left:3px;padding-right:3px;gap:1px}}";
  document.head.appendChild(mobileCss);
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",addMobileNav,{once:true}); else addMobileNav();

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
          var mobileBadge=document.getElementById("rnMobileUnread");
          if(mobileBadge){mobileBadge.textContent=n>99?"99+":String(n);mobileBadge.hidden=!(n>0);}
          link.setAttribute("aria-label", n > 0 ? "Messages, " + n + " unread" : "Messages");
        }catch(e){}
      };
      refresh(); setInterval(refresh, 60000);
      window.addEventListener("focus", refresh); window.addEventListener("rn:unread", refresh);
      document.addEventListener("visibilitychange", function(){ if(!document.hidden){ refresh(); } });
    }catch(e){ showPage(); }
  });
})();
