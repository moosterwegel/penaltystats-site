// Page-hit counting — public deployment only. Ships to both targets like
// api-shim.js, but no-ops unless PENALTY_CONFIG.analytics.goatcounter is set,
// so the private dashboard phones nobody.
//
// GoatCounter is the counter maxoosterwegel.com already uses: no cookies, no
// cross-site identifiers, no personal data retained (it hashes IP + User-Agent
// with a rotating salt purely to dedupe a repeat view, then discards it), which
// is why the site carries no consent banner. count.js finds its endpoint by
// querying for the script[data-goatcounter] element, so injecting the tag from
// here works exactly like the hardcoded snippet on the blog.
(() => {
  const cfg = window.PENALTY_CONFIG || {};
  const endpoint = cfg.analytics && cfg.analytics.goatcounter;
  if (!endpoint) return;

  const s = document.createElement("script");
  s.async = true;
  s.src = "https://gc.zgo.at/count.js";
  s.dataset.goatcounter = endpoint;
  document.head.appendChild(s);
})();
