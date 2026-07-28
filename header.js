// Shared page header. Pages carry an empty <nav class="ph-nav" data-page="…">
// placeholder (and brand links marked data-brand); this script fills the nav
// from PENALTY_CONFIG so the two deployments show their own page sets without
// per-page hardcoded link lists — the drift that forked the old frontends.
// The link LABELS — like every other sentence on the site — live in copy.js,
// which also fills the page titles and the brand marks ({brand} comes from the
// config, so each deployment names itself).
(() => {
  const cfg = window.PENALTY_CONFIG || {};
  const HREF = {
    takers:   "index.html",
    keepers:  "keepers.html",
    shotmap:  "shotmap-takers.html",
    compare:  "compare.html",
    shootout: "shootout.html",
    heatmap:  "heatmap.html",
    models:   "models.html",
    matches:  "matches.html",
    recent:   "recent.html",
    about:    "about.html",
  };
  const nav = document.querySelector("nav.ph-nav");
  if (nav) {
    const page = nav.dataset.page;
    nav.innerHTML = (cfg.nav || Object.keys(HREF))
      .filter((id) => HREF[id])
      .map((id) => `<a href="${HREF[id]}"${id === page ? ' class="active"' : ""}>${T("nav." + id)}</a>`)
      .join("");
  }
})();
