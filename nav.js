/* Header: Messages link with an unread count. Also: a blocked account sees only a 404 page, everywhere. */
(function(){
  var URL_ = "https://abppfpgazlngdhrejrog.supabase.co", KEY = "sb_publishable_aDiJt8SXRag8hD73rhiFuQ_ezmlGWo5";
  /* Premium popup: premium.js adds the Premium button to the header and opens the popup. */
  if(!window.openPremium && !document.getElementById("premJs")){ var pj = document.createElement("script"); pj.id = "premJs"; pj.src = "premium.js?v=20261119b"; pj.defer = true; document.head.appendChild(pj); }
  /* Role switch helper for contextual notices; the account-mode control lives in My Account. */
  if(!window.RoleSwitch && !document.getElementById("rsJs")){ var rj = document.createElement("script"); rj.id = "rsJs"; rj.src = "role-switch.js"; rj.defer = true; document.head.appendChild(rj); }
  function showPage(){ document.documentElement.style.display = ""; }
  function notFound(){
    try{ localStorage.setItem("rn_blk", "1"); }catch(e){}
    document.documentElement.style.display = "";
    document.documentElement.innerHTML = '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="theme-color" content="#0b367d"><link rel="icon" type="image/svg+xml" href="renterhere-mark.svg"><title>RenterHere | 404 Not Found</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#f5f8fd;color:#172b4d;text-align:center}h1{font-size:4.5rem;margin:0}p{color:#66758f;margin:6px 0 0}</style></head><body><div><h1>404</h1><p>Page not found</p></div></body>';
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
    "@media(max-width:760px){body{padding-bottom:calc(76px + env(safe-area-inset-bottom,0px))!important}.rn-mobile-nav{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr));align-items:stretch;gap:2px;position:fixed;z-index:10000;left:0;right:0;bottom:0;width:100%;box-sizing:border-box;padding:7px 5px calc(7px + env(safe-area-inset-bottom,0px));background:rgba(255,255,255,.97);border-top:1px solid #dce5f2;box-shadow:0 -5px 22px rgba(15,35,40,.09);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}.rn-mobile-item{position:relative;min-width:0;min-height:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:4px 1px;margin:0!important;border:0!important;border-radius:12px;text-decoration:none!important;color:#66758f!important;font:600 10.5px/1.15 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;white-space:nowrap;-webkit-tap-highlight-color:transparent}.rn-mobile-item svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:0 0 auto}.rn-mobile-item.active{color:#0b367d!important;background:#e8f0fc}.rn-mobile-item:focus-visible{outline:2px solid #f36a16;outline-offset:-2px}.rn-mobile-badge{position:absolute;top:0;left:calc(50% + 5px);min-width:15px;height:15px;padding:0 3px;border-radius:99px;background:#d93025;color:#fff;font:700 9px/15px system-ui,sans-serif;text-align:center}.rn-mobile-badge[hidden]{display:none!important}}@media(max-width:360px){.rn-mobile-item{font-size:9.5px;gap:3px}.rn-mobile-item svg{width:19px;height:19px}.rn-mobile-nav{padding-left:3px;padding-right:3px;gap:1px}}";
  document.head.appendChild(mobileCss);
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",addMobileNav,{once:true}); else addMobileNav();


  /* First-visit welcome sign-in prompt. Public browsing remains available to guests. */
  function showWelcomeAuth(client){
    var currentPage = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    var privatePages = ["login.html","account.html","messages.html","my-listings.html","create-listing.html","admin.html"];
    if(privatePages.indexOf(currentPage) !== -1) return;

    function wasSeen(){
      try{ return localStorage.getItem("rn_welcome_auth_seen_v1") === "1"; }
      catch(e){ try{ return sessionStorage.getItem("rn_welcome_auth_seen_v1") === "1"; }catch(ignore){ return false; } }
    }
    function markSeen(){
      try{ localStorage.setItem("rn_welcome_auth_seen_v1","1"); }
      catch(e){ try{ sessionStorage.setItem("rn_welcome_auth_seen_v1","1"); }catch(ignore){} }
    }
    if(wasSeen()) return;

    var returnPages = [
      "index.html","listings.html","listing.html","reviews.html","blog.html","about.html",
      "avoid-rental-scams.html","contact.html","find-compatible-roommates.html",
      "first-apartment-budget.html","privacy.html","questions-to-ask-roommate.html",
      "rental-application-checklist.html","rental-faq.html","room-for-rent-search-guide.html",
      "roommate-agreement-guide.html","safety.html","terms.html","whats-your-20-meaning.html",
      "sitemap.html"
    ];
    var next = returnPages.indexOf(currentPage) !== -1 ? currentPage : "index.html";
    if(currentPage === "listing.html"){
      var listingId = new URLSearchParams(location.search).get("id") || "";
      if(/^[0-9a-fA-F-]{36}$/.test(listingId)) next = "listing.html?id=" + listingId;
      else next = "index.html";
    }
    var nextParam = encodeURIComponent(next);
    var signUpUrl = "login.html?next=" + nextParam + "&mode=signup";
    var signInUrl = "login.html?next=" + nextParam + "&mode=login";

    var css = document.createElement("style");
    css.id = "rnWelcomeAuthCss";
    css.textContent =
      ".rn-welcome-overlay{position:fixed;z-index:12000;inset:0;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(5,24,28,.62);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}" +
      ".rn-welcome-dialog{position:relative;width:min(100%,440px);max-height:calc(100vh - 36px);overflow:auto;background:#fff;border:1px solid #d6e8e3;border-radius:22px;padding:34px 30px 25px;box-shadow:0 24px 80px rgba(0,0,0,.28);text-align:center;color:#1a2e2c;font:15px/1.55 system-ui,-apple-system,'Segoe UI',sans-serif}" +
      ".rn-welcome-close{position:absolute;right:13px;top:12px;width:36px;height:36px;border:0;border-radius:50%;background:#f1f6f4;color:#526966;font:24px/1 system-ui;cursor:pointer}" +
      ".rn-welcome-logo{width:54px;height:54px;display:block;margin:0 auto 12px}" +
      ".rn-welcome-kicker{margin:0 0 7px;color:#0b7a6e;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}" +
      ".rn-welcome-title{margin:0 0 9px;color:#0a2e36;font:800 clamp(25px,5vw,30px)/1.15 system-ui,-apple-system,'Segoe UI',sans-serif;letter-spacing:-.7px}" +
      ".rn-welcome-copy{margin:0 auto 22px;max-width:340px;color:#5a6e6b;font-size:14px}" +
      ".rn-welcome-actions{display:grid;gap:10px}" +
      ".rn-welcome-google,.rn-welcome-email{width:100%;min-height:49px;display:flex;align-items:center;justify-content:center;gap:11px;border-radius:11px;padding:12px 16px;font:700 15px system-ui,-apple-system,'Segoe UI',sans-serif;text-decoration:none;cursor:pointer;box-sizing:border-box}" +
      ".rn-welcome-google{background:#fff;border:1px solid #cbd8d5;color:#1f2937;box-shadow:0 1px 2px rgba(10,46,54,.05)}" +
      ".rn-welcome-google:hover{background:#f8fbfa;border-color:#9dbab3}" +
      ".rn-welcome-google:disabled{opacity:.6;cursor:wait}" +
      ".rn-welcome-google svg{width:20px;height:20px;flex:0 0 20px}" +
      ".rn-welcome-email{background:#0b7a6e;border:1px solid #0b7a6e;color:#fff}" +
      ".rn-welcome-email:hover{background:#08685e}" +
      ".rn-welcome-login{margin:17px 0 0;color:#5a6e6b;font-size:13px}" +
      ".rn-welcome-login a,.rn-welcome-legal a{color:#0b7a6e;font-weight:700;text-decoration:none}" +
      ".rn-welcome-login a:hover,.rn-welcome-legal a:hover{text-decoration:underline}" +
      ".rn-welcome-guest{margin:12px 0 0;background:none;border:0;padding:7px 12px;color:#526966;font:600 13px system-ui;cursor:pointer;text-decoration:underline;text-underline-offset:3px}" +
      ".rn-welcome-legal{margin:15px 0 0;color:#8a9a97;font-size:11px}" +
      ".rn-welcome-message{min-height:18px;margin:7px 0 0;color:#b3261e;font-size:12px}" +
      "@media(max-width:420px){.rn-welcome-dialog{padding:31px 21px 21px;border-radius:18px}.rn-welcome-title{font-size:25px}}";
    document.head.appendChild(css);

    var overlay = document.createElement("div");
    overlay.className = "rn-welcome-overlay";
    overlay.innerHTML =
      '<section class="rn-welcome-dialog" role="dialog" aria-modal="true" aria-labelledby="rnWelcomeTitle" aria-describedby="rnWelcomeCopy">' +
        '<button type="button" class="rn-welcome-close" aria-label="Close sign-in prompt">&times;</button>' +
        '<img class="rn-welcome-logo" src="renterhere-mark.svg" alt="RenterHere">' +
        '<p class="rn-welcome-kicker">Find • Rent • Live Better</p>' +
        '<h2 class="rn-welcome-title" id="rnWelcomeTitle">Welcome to RenterHere</h2>' +
        '<p class="rn-welcome-copy" id="rnWelcomeCopy">Find your next place and connect with landlords. Sign in to message, save and manage your rental search.</p>' +
        '<div class="rn-welcome-actions">' +
          '<button type="button" class="rn-welcome-google" id="rnWelcomeGoogle">' +
            '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15z"/><path fill="#34A853" d="M24 44c5.5 0 10.2-1.8 13.6-4.9L31 34c-1.8 1.2-4.1 1.9-7 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2A20 20 0 0 0 24 44z"/><path fill="#FBBC05" d="M12.6 27.5a12 12 0 0 1 0-7V15H5.8a20 20 0 0 0 0 18z"/><path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.9-5.9C34.1 6 29.5 4 24 4A20 20 0 0 0 5.8 15l6.8 5.2c1.6-4.8 6.1-8.1 11.4-8.1z"/></svg>' +
            '<span>Continue with Google</span>' +
          '</button>' +
          '<a class="rn-welcome-email" href="' + signUpUrl + '" id="rnWelcomeEmail">Continue with email</a>' +
        '</div>' +
        '<p class="rn-welcome-login">Already have an account? <a href="' + signInUrl + '" id="rnWelcomeLogin">Log in</a></p>' +
        '<button type="button" class="rn-welcome-guest" id="rnWelcomeGuest">Browse rentals as a guest</button>' +
        '<p class="rn-welcome-legal">By continuing, you agree to our <a href="terms.html">Terms</a> and <a href="privacy.html">Privacy Policy</a>.</p>' +
        '<p class="rn-welcome-message" id="rnWelcomeMessage" role="status" aria-live="polite"></p>' +
      '</section>';
    document.body.appendChild(overlay);
    var previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    var googleButton = document.getElementById("rnWelcomeGoogle");
    var message = document.getElementById("rnWelcomeMessage");

    function closePrompt(){
      markSeen();
      overlay.remove();
      document.body.style.overflow = previousOverflow;
    }
    overlay.querySelector(".rn-welcome-close").onclick = closePrompt;
    document.getElementById("rnWelcomeGuest").onclick = closePrompt;
    overlay.addEventListener("click", function(event){ if(event.target === overlay) closePrompt(); });
    overlay.querySelector("#rnWelcomeEmail").addEventListener("click", markSeen);
    overlay.querySelector("#rnWelcomeLogin").addEventListener("click", markSeen);
    document.addEventListener("keydown", function onWelcomeKey(event){
      if(event.key === "Escape" && document.body.contains(overlay)){
        closePrompt();
        document.removeEventListener("keydown", onWelcomeKey);
      }
    });

    googleButton.onclick = async function(){
      googleButton.disabled = true;
      message.textContent = "Connecting to Google…";
      try{
        var redirectUrl = new URL("login.html", location.href).href + "?next=" + nextParam;
        var result = await client.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: redirectUrl,
            queryParams: { prompt: "select_account" }
          }
        });
        if(result && result.error) throw result.error;
      }catch(error){
        googleButton.disabled = false;
        var reason = (error && error.message) || "Google sign-in could not be started. Please try again.";
        if(/provider.*not enabled|unsupported provider|google.*not enabled/i.test(reason)){
          reason = "Google sign-in is not enabled in Supabase Auth yet. Please use email sign-in for now.";
        }else if(/redirect.*not allowed|redirect_to.*not allowed|redirect url.*not allowed/i.test(reason)){
          reason = "This website address must be added to the Supabase Auth redirect allow list.";
        }
        message.textContent = reason;
      }
    };

    window.setTimeout(function(){
      var focusTarget = document.getElementById("rnWelcomeGoogle");
      if(focusTarget && document.body.contains(overlay)) focusTarget.focus();
    }, 40);
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
      if(!s.data.session){ try{ localStorage.removeItem("rn_blk"); }catch(e){} showPage(); showWelcomeAuth(client); return; }
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
