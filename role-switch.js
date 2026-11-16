/* RenterHere role switch (Airbnb style).
   One login works as a Renter account or a Landlord account. The active mode is profiles.role,
   and the database function switch_my_role() changes it. Nothing is deleted when someone switches:
   listings, sent messages, Contact Pass and Landlord Premium stay with the account.

   Pages use:
     RoleSwitch.getRole()             -> "renter" | "landlord" | "admin" | null (logged out)
     RoleSwitch.switchTo("landlord")  -> { ok: true, role } or { ok: false, error }
     RoleSwitch.notice({ to, title, text, plain, cancelHref, cancelText, onSwitched })
                                      -> a card with a one-click Switch button
   It also adds a "Switch to Landlord / Renter" link to the header (#nav) for signed-in renter and landlord accounts. */
(function(){
  if(window.RoleSwitch) return;
  var SB_URL = "https://abppfpgazlngdhrejrog.supabase.co", SB_KEY = "sb_publishable_aDiJt8SXRag8hD73rhiFuQ_ezmlGWo5";

  var css = document.createElement("style");
  css.textContent =
    ".rs-card{background:#fff;border:1px solid var(--line,#d6e8e3);border-left:4px solid var(--blue,#0b7a6e);border-radius:14px;padding:16px 18px;margin:0 0 14px;color:var(--ink,#1a2e2c);text-align:left}" +
    ".rs-card.rs-plain{border:0;border-radius:0;padding:0;margin:0}" +
    ".rs-title{font:800 1.05rem/1.3 system-ui,sans-serif;color:var(--navy,#0a2e36);margin:0 0 4px}" +
    ".rs-text{margin:0;color:var(--muted,#5a6e6b)}" +
    ".rs-actions{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;margin-top:12px}" +
    ".rs-card button.rs-btn{margin:0;padding:10px 20px;border:0;border-radius:10px;background:var(--blue,#0b7a6e);color:#fff;font:600 1rem system-ui,sans-serif;cursor:pointer}" +
    ".rs-card button.rs-btn:disabled{opacity:.6;cursor:wait}" +
    ".rs-card a.rs-link{color:var(--blue,#0b7a6e);font-weight:600}" +
    ".rs-msg{min-height:1.2em;margin:8px 0 0;font-size:.95rem;color:var(--muted,#5a6e6b)}" +
    ".rs-msg.err{color:#b3261e}" +
    "#nav a.rs-nav{color:var(--blue,#0b7a6e);font-weight:600;white-space:nowrap}" +
    ".rs-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:100001;max-width:min(92vw,520px);padding:12px 18px;border-radius:12px;background:#b3261e;color:#fff;font:600 .95rem/1.4 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25)}";
  document.head.appendChild(css);

  function h(tag, cls, text){ var e = document.createElement(tag); if(cls) e.className = cls; if(text !== undefined) e.textContent = text; return e; }
  function cap(s){ return String(s).charAt(0).toUpperCase() + String(s).slice(1); }

  /* ---- Supabase client (reuses the page's own client when it exists) ---- */
  var clientPromise = null;
  function client(){
    if(window.sb && window.sb.auth) return Promise.resolve(window.sb);
    if(clientPromise) return clientPromise;
    clientPromise = new Promise(function(resolve){
      var tries = 0;
      if(!(window.supabase && window.supabase.createClient) && !document.querySelector('script[src*="supabase-js"]')){
        var s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
        document.head.appendChild(s);
      }
      (function wait(){
        if(window.sb && window.sb.auth){ resolve(window.sb); return; }
        if(window.supabase && window.supabase.createClient){ resolve(window.supabase.createClient(SB_URL, SB_KEY)); return; }
        if(++tries > 60){ resolve(null); return; }
        setTimeout(wait, 150);
      })();
    });
    return clientPromise;
  }

  /* ---- who is signed in, and in which mode? ---- */
  var rolePromise = null;
  function getRole(force){
    if(rolePromise && !force) return rolePromise;
    rolePromise = (async function(){
      try{
        var c = await client(); if(!c) return null;
        var s = await c.auth.getSession();
        if(!s.data || !s.data.session) return null;
        var p = await c.from("profiles").select("role").eq("id", s.data.session.user.id).maybeSingle();
        return p.data && p.data.role ? String(p.data.role) : "renter";
      }catch(e){ return null; }
    })();
    return rolePromise;
  }

  async function switchTo(role){
    try{
      var c = await client();
      if(!c) return { ok: false, error: "Could not connect. Please refresh the page and try again." };
      var r = await c.rpc("switch_my_role", { p_role: role });
      if(r.error){
        var m = r.error.message || "";
        if(r.error.code === "PGRST202" || /switch_my_role|schema cache/i.test(m)){
          return { ok: false, error: "Switching accounts is not set up on the database yet." };
        }
        return { ok: false, error: m || "Could not switch. Please try again." };
      }
      rolePromise = null;
      try{ window.dispatchEvent(new CustomEvent("rn:rolechange", { detail: { role: role } })); }catch(e){}
      return { ok: true, role: role };
    }catch(e){
      return { ok: false, error: "Something went wrong. Please try again." };
    }
  }

  /* ---- the notice card: says what is wrong, offers a one-click switch ---- */
  function notice(o){
    var box = h("div", "rs-card" + (o.plain ? " rs-plain" : ""));
    box.setAttribute("role", "status");
    box.appendChild(h("div", "rs-title", o.title));
    box.appendChild(h("p", "rs-text", o.text));
    var row = h("div", "rs-actions");
    var btn = h("button", "rs-btn", "Switch to " + cap(o.to) + " account"); btn.type = "button";
    var msg = h("p", "rs-msg");
    btn.onclick = async function(){
      btn.disabled = true; msg.className = "rs-msg"; msg.textContent = "Switching...";
      var r = await switchTo(o.to);
      if(r.ok){
        msg.textContent = "Switched to your " + cap(o.to) + " account.";
        if(typeof o.onSwitched === "function"){ o.onSwitched(r.role); } else { location.reload(); }
      } else {
        btn.disabled = false; msg.className = "rs-msg err"; msg.textContent = r.error;
      }
    };
    row.appendChild(btn);
    if(o.cancelHref){ var a = h("a", "rs-link", o.cancelText || "Not now"); a.href = o.cancelHref; row.appendChild(a); }
    box.appendChild(row); box.appendChild(msg);
    return box;
  }

  function toast(text){
    var old = document.querySelector(".rs-toast"); if(old) old.remove();
    var t = h("div", "rs-toast", text); t.setAttribute("role", "alert");
    document.body.appendChild(t);
    setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 9000);
  }

  /* ---- header link: one tap to switch from any page ---- */
  async function mountHeader(){
    var nav = document.getElementById("nav");
    if(!nav || document.getElementById("rsNav")) return;
    var role = await getRole();
    if(role !== "renter" && role !== "landlord") return;
    if(document.getElementById("rsNav")) return;
    var to = role === "renter" ? "landlord" : "renter";
    var a = h("a", "rs-nav", "Switch to " + cap(to));
    a.id = "rsNav"; a.href = "#"; a.title = "You are using your " + cap(role) + " account";
    a.onclick = async function(e){
      e.preventDefault();
      a.textContent = "Switching...";
      var r = await switchTo(to);
      if(r.ok){ location.reload(); return; }
      a.textContent = "Switch to " + cap(to);
      toast("Could not switch: " + r.error);
    };
    nav.insertBefore(a, nav.querySelector("a.pill") || null);
  }
  /* wait one tick so a page's own inline script has created its Supabase client first */
  if(document.readyState === "loading"){ document.addEventListener("DOMContentLoaded", mountHeader, { once: true }); }
  else { setTimeout(mountHeader, 0); }

  window.RoleSwitch = { getRole: getRole, switchTo: switchTo, notice: notice };
})();
