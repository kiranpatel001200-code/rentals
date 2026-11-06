/* RentNest Premium popup.
   Pages open it with openPremium("landlord") or openPremium("renter"); openPremium("landlord", { once: "some-key" })
   shows it only once per browser session for that key. It also opens from any element that has a data-premium
   attribute and from every "premium offer" link.
   A logged-in renter sees the renter benefits, a logged-in landlord sees the landlord benefits.
   A visitor who is logged out (or an admin) sees both, with two tabs.
   To change the wording, edit RENTER() and LANDLORD below. */
(function(){
  if(window.openPremium) return;
  var SB_URL = "https://abppfpgazlngdhrejrog.supabase.co", SB_KEY = "sb_publishable_aDiJt8SXRag8hD73rhiFuQ_ezmlGWo5";

  /* ---- Renter benefits (these match what the Renter Contact Pass really does) ---- */
  function RENTER(){
    var price = (window.PASS && window.PASS.price) || "$4.99";
    return {
      title: "Renter Premium",
      sub: "The Renter Contact Pass",
      items: [
        ["\uD83D\uDD13", "Unlock up to 3 listing contacts", "Get the landlord's phone, email and WhatsApp for 3 different approved rental listings. These are 3 contact leads, not 3 messages."],
        ["\uD83D\u267B", "Reopen the same listing anytime", "Opening one of your 3 unlocked listings again does not use another contact slot."],
        ["\u26A1", "Contact landlords directly", "Use the details you unlock to call, email or WhatsApp the landlord."],
        ["\uD83D\uDCB3", "One-time pass", price + " once for 1 year. It does not renew automatically."],
        ["\uD83D\uDCC8", "Need more than 3 contact leads?", "After all 3 different listings are used, contact RentNest about a larger premium offer."]
      ],
      fine: "A verified email is required before purchase. Purchases are final and non-refundable."
    };
  }

  /* ---- Landlord benefits ----
     PLACEHOLDER TEXT: keep only what you really offer to landlords, and change the rest. */
  function LANDLORD(){
    return {
      title: "Landlord Premium",
      sub: "More visibility and room to grow on RentNest",
      items: [
        ["\u2B50", "Priority search placement", "Active Premium listings appear ahead of standard listings in matching rental searches."],
        ["\uD83C\uDFE0", "Unlimited active listings", "Grow your rental portfolio without the Free plan's 5-active-listing limit."],
        ["\uD83D\uDCE3", "Featured visibility", "Premium placement helps your eligible listings stand out to renters searching in your area."],
        ["\u2705", "Spot verified-email enquiries", "The Messages inbox marks renters whose email address has been verified."],
        ["\uD83D\uDCC8", "Keep renter enquiries together", "Review messages, move-in dates and viewing requests from your Messages inbox."]
      ],
      fine: "Landlord Premium is separate from the Renter Contact Pass. The 3-contact limit applies to renter contact unlocks, not to messages a landlord receives."
    };
  }

  /* ---- styles ---- */
  var css = document.createElement("style");
  css.textContent =
    ".prem-ov{position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:rgba(11,42,91,.55);display:flex;padding:16px;overflow:auto}" +
    ".prem-box{position:relative;margin:auto;width:100%;max-width:460px;background:#fff;color:#1b2a41;border-radius:18px;overflow:hidden;box-shadow:0 20px 60px rgba(4,20,52,.4);font:16px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;text-align:left}" +
    ".prem-head{background:linear-gradient(135deg,#0b2a5b 0%,#1558c9 62%,#1769e8 100%);color:#fff;padding:22px 56px 18px 24px}" +
    ".prem-head h2{margin:0 0 4px;font:800 1.35rem/1.2 system-ui,sans-serif;color:#fff}" +
    ".prem-head p{margin:0;color:#d6e5ff;font-size:.95rem}" +
    ".prem-box button.prem-x{position:absolute;top:12px;right:12px;width:34px;height:34px;margin:0;padding:0;border:0;border-radius:99px;background:rgba(255,255,255,.2);color:#fff;font:400 1.4rem/34px system-ui,sans-serif;cursor:pointer}" +
    ".prem-tabs{display:flex;gap:8px;padding:14px 24px 0}" +
    ".prem-box button.prem-tab{margin:0;padding:8px 16px;border:1px solid #dbe6f6;border-radius:99px;background:#fff;color:#1769e8;font:600 .92rem system-ui,sans-serif;cursor:pointer}" +
    ".prem-box button.prem-tab.on{background:#1769e8;border-color:#1769e8;color:#fff}" +
    ".prem-list{list-style:none;margin:0;padding:12px 24px 4px}" +
    ".prem-list li{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid #dbe6f6}" +
    ".prem-list li:last-child{border-bottom:0}" +
    ".prem-list i{flex:none;width:34px;font-style:normal;font-size:1.5rem;text-align:center}" +
    ".prem-list b{display:block;color:#0b2a5b}" +
    ".prem-list span{color:#5b6b82;font-size:.93rem}" +
    ".prem-foot{padding:10px 24px 22px}" +
    ".prem-status{margin:0 0 10px;padding:10px 12px;background:#eef4ff;border:1px solid #bcd3fb;border-radius:10px;font-size:.92rem;color:#0b2a5b}" +
    ".prem-box a.prem-cta{display:block;padding:12px 20px;border-radius:10px;background:#1769e8;color:#fff;font-weight:600;text-align:center;text-decoration:none}" +
    ".prem-fine{margin:10px 0 0;font-size:.85rem;color:#5b6b82;text-align:center}" +
    ".prem-fine a{color:#1769e8}";
  document.head.appendChild(css);

  function h(tag, cls, text){ var e = document.createElement(tag); if(cls) e.className = cls; if(text !== undefined) e.textContent = text; return e; }

  /* ---- who is looking? ---- */
  var client = null;
  function getClient(){
    if(client) return client;
    if(window.sb && window.sb.auth){ client = window.sb; return client; }
    if(window.supabase && window.supabase.createClient){ client = window.supabase.createClient(SB_URL, SB_KEY); return client; }
    return null;
  }
  async function getState(){
    var st = { loggedIn: false, role: null, pass: null, usage: 0 };
    try{
      var c = getClient(); if(!c) return st;
      var s = await c.auth.getSession(); var session = s.data && s.data.session;
      if(!session) return st;
      st.loggedIn = true;
      var p = await c.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
      st.role = p.data && p.data.role ? p.data.role : "renter";
      if(st.role === "renter" && typeof window.passInfo === "function"){
        st.pass = await window.passInfo();
        if(st.pass && st.pass.active){
          var u = await c.rpc("my_contact_usage");
          if(!u.error){ st.usage = Math.max(0, Number(u.data) || 0); }
        }
      }
    }catch(e){}
    return st;
  }

  /* ---- the popup ---- */
  var ov = null, lastFocus = null, keyFn = null;
  function close(){
    if(!ov) return;
    document.removeEventListener("keydown", keyFn);
    if(ov.parentNode){ ov.parentNode.removeChild(ov); }
    ov = null; document.body.style.overflow = "";
    if(lastFocus && lastFocus.focus){ try{ lastFocus.focus(); }catch(e){} }
  }
  function cta(href, text){ var a = h("a", "prem-cta", text); a.href = href; a.onclick = function(){ close(); }; return a; }

  function fill(mode, st, tabs, parts){
    var d = mode === "landlord" ? LANDLORD() : RENTER();
    parts.title.textContent = d.title; parts.sub.textContent = d.sub;
    if(parts.tabs){ parts.tabs.forEach(function(t){ t.btn.className = "prem-tab" + (t.mode === mode ? " on" : ""); t.btn.setAttribute("aria-pressed", t.mode === mode ? "true" : "false"); }); }
    parts.list.textContent = ""; parts.foot.textContent = "";
    d.items.forEach(function(it){
      var li = h("li"); li.appendChild(h("i", "", it[0]));
      var txt = h("div"); txt.appendChild(h("b", "", it[1])); txt.appendChild(h("span", "", it[2]));
      li.appendChild(txt); parts.list.appendChild(li);
    });
    if(mode === "landlord"){
      parts.foot.appendChild(st.loggedIn ? cta("contact.html?topic=landlord-premium", "Contact us about Landlord Premium") : cta("login.html?next=my-listings.html", "Log in or sign up"));
    } else if(!st.loggedIn){
      parts.foot.appendChild(cta("login.html?next=account.html", "Log in or sign up"));
    } else if(st.pass && st.pass.active){
      var used = Math.min(Math.max(0, Number(st.usage) || 0), 3);
      var remaining = Math.max(0, 3 - used);
      var line = (typeof window.passStatusText === "function") ? window.passStatusText(st.pass) : "Your Contact Pass is active.";
      parts.foot.appendChild(h("p", "prem-status", line + " Contact leads used: " + used + "/3. " + remaining + " remaining."));
      if(used >= 3){
        parts.foot.appendChild(cta("contact.html?topic=premium-upgrade", "Contact us for more than 3 leads"));
      } else {
        parts.foot.appendChild(cta("listings.html", "Browse rentals and use your remaining contacts"));
      }
    } else {
      var price = (window.PASS && window.PASS.price) || "$4.99";
      parts.foot.appendChild(cta("account.html#cPassCard", "Get the Renter Contact Pass (" + price + ")"));
    }
    var fine = h("p", "prem-fine", d.fine + (mode === "renter" ? " See the " : ""));
    if(mode === "renter"){ var ta = h("a", "", "Terms of Service"); ta.href = "terms.html"; fine.appendChild(ta); fine.appendChild(document.createTextNode(".")); }
    parts.foot.appendChild(fine);
  }

  async function openPremium(kind, opts){
    if(opts && opts.once){
      try{ var k = "rn_prem_" + opts.once; if(sessionStorage.getItem(k)) return; sessionStorage.setItem(k, "1"); }catch(e){}
    }
    close();
    var st = await getState();
    var forced = (kind === "renter" || kind === "landlord") ? kind : null;
    var known = (st.role === "renter" || st.role === "landlord") ? st.role : null;
    var mode = forced || known || "renter";
    var tabs = !forced && !known;   /* logged out or admin: show both sides */

    lastFocus = document.activeElement;
    ov = h("div", "prem-ov");
    var box = h("div", "prem-box"); box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-labelledby", "premTitle");
    var x = h("button", "prem-x", "\u00D7"); x.type = "button"; x.setAttribute("aria-label", "Close"); x.onclick = close;
    var head = h("div", "prem-head"), title = h("h2"), sub = h("p"); title.id = "premTitle";
    head.appendChild(title); head.appendChild(sub);
    var parts = { title: title, sub: sub, list: h("ul", "prem-list"), foot: h("div", "prem-foot"), tabs: null };
    box.appendChild(x); box.appendChild(head);
    if(tabs){
      var row = h("div", "prem-tabs"); parts.tabs = [];
      [["renter", "I am a renter"], ["landlord", "I am a landlord"]].forEach(function(t){
        var b = h("button", "prem-tab", t[1]); b.type = "button";
        b.onclick = function(){ fill(t[0], st, tabs, parts); };
        row.appendChild(b); parts.tabs.push({ mode: t[0], btn: b });
      });
      box.appendChild(row);
    }
    box.appendChild(parts.list); box.appendChild(parts.foot);
    ov.appendChild(box);
    ov.addEventListener("click", function(e){ if(e.target === ov){ close(); } });
    keyFn = function(e){
      if(e.key === "Escape"){ close(); return; }
      if(e.key === "Tab" && ov){
        var f = ov.querySelectorAll("a[href],button"); if(!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", keyFn);
    fill(mode, st, tabs, parts);
    document.body.appendChild(ov); document.body.style.overflow = "hidden";
    x.focus();
  }
  window.openPremium = openPremium;

  /* Any element with data-premium, and any "premium offer" link, opens the popup. */
  document.addEventListener("click", function(e){
    var t = e.target && e.target.closest ? e.target.closest("[data-premium], a[href*='topic=premium-upgrade'], a[href*='topic=landlord-premium']") : null;
    if(!t || t.closest(".prem-ov")) return;
    e.preventDefault();
    openPremium(t.getAttribute("data-premium"));
  });
})();
