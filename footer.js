(function () {
  "use strict";
  var YEAR = String(new Date().getFullYear());
  var html = `
    <footer class="rn-footer" role="contentinfo">
      <div class="rn-footer__inner">
        <div class="rn-footer__top">
          <section class="rn-footer__brand" aria-label="About RentNest">
            <a class="rn-footer__brand-link" href="index.html" aria-label="RentNest home">
              <span class="rn-footer__mark" aria-hidden="true">
                <svg viewBox="0 0 44 44" width="42" height="42" fill="none">
                  <path d="M5.5 20.5 22 6.5l16.5 14V36a2.5 2.5 0 0 1-2.5 2.5H8A2.5 2.5 0 0 1 5.5 36Z" stroke="currentColor" stroke-width="2.8" stroke-linejoin="round"/>
                  <path d="M16 31V20l6 6 6-6v11" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <span class="rn-footer__wordmark">RentNest<small>Find Your Perfect Rental</small></span>
            </a>
            <p class="rn-footer__description">A simpler way to explore rentals and connect with landlords across the United States.</p>
            <div class="rn-footer__trust">
              <span><i aria-hidden="true">✓</i> Clear listing details</span>
              <span><i aria-hidden="true">✓</i> Email-verified accounts</span>
            </div>
          </section>
          <nav class="rn-footer__group" aria-label="Explore RentNest">
            <h2>Explore</h2>
            <a href="index.html">Home</a>
            <a href="listings.html">Browse rentals</a>
            <a href="reviews.html">Reviews</a>
            <a href="create-listing.html">List your property</a>
            <a href="my-listings.html">My listings</a>
            <a href="messages.html">Messages</a>
          </nav>
          <nav class="rn-footer__group" aria-label="Help and support">
            <h2>Help &amp; support</h2>
            <a href="about.html">About RentNest</a>
            <a href="contact.html">Contact Us</a>
            <a href="safety.html">Rental safety tips</a>
            <a href="sitemap.html">Sitemap</a>
          </nav>
          <nav class="rn-footer__group" aria-label="Policies">
            <h2>Policies</h2>
            <a href="privacy.html">Privacy Policy</a>
            <a href="terms.html">Terms of Service</a>
            <p class="rn-footer__policy-note">Your privacy matters. Review how your information is used and the rules for using RentNest.</p>
          </nav>
        </div>
        <div class="rn-footer__safety">
          <span class="rn-footer__safety-icon" aria-hidden="true">!</span>
          <p><strong>Rent smart and stay safe.</strong> Visit a property, review the lease, and confirm the landlord before sending money. If something feels wrong, stop and verify.</p>
        </div>
        <div class="rn-footer__bottom">
          <p>© __YEAR__ RentNest. Better Homes. Happier Lives.</p>
          <p>U.S. rentals · Prices shown in USD</p>
          <a href="contact.html">Need help? Contact us <span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </footer>`.replace("__YEAR__", YEAR);

  var style = document.getElementById("rn-footer-styles");
  if (!style) {
    style = document.createElement("style");
    style.id = "rn-footer-styles";
    style.textContent = `
      .rn-footer{--rnf-navy:#081f49;--rnf-blue:#8bb8ff;--rnf-text:#d6e2f7;--rnf-muted:#a8bddf;background:linear-gradient(140deg,#071a3b 0%,#0b2a5b 58%,#10376f 100%);color:var(--rnf-text);margin-top:44px;padding:0;font:400 15px/1.65 system-ui,-apple-system,"Segoe UI",sans-serif}
      .rn-footer *{box-sizing:border-box}
      .rn-footer a{color:var(--rnf-text);text-decoration:none;transition:color .18s ease,opacity .18s ease}
      .rn-footer a:hover{color:#fff;text-decoration:underline;text-underline-offset:4px}
      .rn-footer a:focus-visible{outline:3px solid #f7c948;outline-offset:4px;border-radius:4px}
      .rn-footer__inner{width:min(1120px,100%);margin:0 auto;padding:48px 24px 20px}
      .rn-footer__top{display:grid;grid-template-columns:minmax(240px,1.65fr) repeat(3,minmax(130px,1fr));gap:38px}
      .rn-footer__brand-link{display:inline-flex;align-items:center;gap:10px;color:#fff!important;text-decoration:none!important}
      .rn-footer__mark{display:grid;place-items:center;width:48px;height:48px;border:1px solid rgba(183,210,255,.4);border-radius:14px;color:#9dc3ff;background:rgba(255,255,255,.06);flex:none}
      .rn-footer__wordmark{display:block;font-size:1.65rem;font-weight:850;letter-spacing:-.045em;line-height:1.05;color:#fff}
      .rn-footer__wordmark small{display:block;color:#b9cff2;font-size:.72rem;font-weight:500;letter-spacing:.01em;margin-top:6px}
      .rn-footer__description{max-width:310px;margin:18px 0 16px;color:var(--rnf-muted);font-size:.94rem}
      .rn-footer__trust{display:grid;gap:7px;color:#c6d9f7;font-size:.85rem}
      .rn-footer__trust i{font-style:normal;color:#9ce1bd;font-weight:800;margin-right:7px}
      .rn-footer__group h2{font:750 .95rem/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.01em;color:#fff;margin:8px 0 15px}
      .rn-footer__group a{display:block;width:fit-content;max-width:100%;padding:4px 0;font-size:.9rem;color:#c8d7ee}
      .rn-footer__policy-note{max-width:225px;color:var(--rnf-muted);font-size:.82rem;line-height:1.6;margin:13px 0 0}
      .rn-footer__safety{display:flex;align-items:center;gap:13px;margin-top:34px;padding:15px 18px;border:1px solid rgba(176,204,247,.18);border-radius:14px;background:rgba(255,255,255,.055)}
      .rn-footer__safety-icon{width:30px;height:30px;border-radius:50%;border:1px solid rgba(255,218,132,.6);color:#ffdc83;display:grid;place-items:center;font-weight:850;flex:none}
      .rn-footer__safety p{margin:0;color:#bdcfea;font-size:.87rem}
      .rn-footer__safety strong{color:#fff}
      .rn-footer__bottom{display:flex;align-items:center;justify-content:space-between;gap:14px 24px;flex-wrap:wrap;margin-top:25px;padding-top:18px;border-top:1px solid rgba(194,214,247,.18)}
      .rn-footer__bottom p{margin:0;color:var(--rnf-muted);font-size:.82rem}
      .rn-footer__bottom a{font-size:.84rem;font-weight:650;color:#e4edff}
      @media(max-width:900px){.rn-footer__top{grid-template-columns:repeat(3,minmax(0,1fr));gap:25px}.rn-footer__brand{grid-column:1/-1}.rn-footer__description{max-width:520px}.rn-footer__trust{grid-template-columns:repeat(2,minmax(0,max-content));gap:18px}}
      @media(max-width:600px){.rn-footer{margin-top:30px}.rn-footer__inner{padding:34px 20px 18px}.rn-footer__top{grid-template-columns:repeat(2,minmax(0,1fr));gap:25px 18px}.rn-footer__brand{grid-column:1/-1}.rn-footer__group h2{margin:2px 0 10px}.rn-footer__group a{font-size:.88rem}.rn-footer__trust{grid-template-columns:1fr;gap:5px}.rn-footer__safety{align-items:flex-start;margin-top:26px;padding:13px}.rn-footer__safety-icon{margin-top:2px}.rn-footer__bottom{align-items:flex-start;flex-direction:column;gap:8px}.rn-footer__bottom p,.rn-footer__bottom a{font-size:.8rem}}
      @media(prefers-reduced-motion:reduce){.rn-footer a{transition:none}}
    `;
    document.head.appendChild(style);
  }

  function mountFooter() {
    var old = document.querySelector(".rn-footer, .site-footer, .account-footer") || document.querySelector("body > footer:last-of-type");
    var mount = document.getElementById("footer");
    if (old && old.classList.contains("rn-footer")) return;
    if (old && old.parentNode) {
      old.outerHTML = html;
    } else if (mount) {
      mount.innerHTML = html;
    } else {
      document.body.insertAdjacentHTML("beforeend", html);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountFooter, { once: true });
  } else {
    mountFooter();
  }
})();