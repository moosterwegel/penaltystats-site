// Per-deployment settings for the PUBLIC static site (GitHub Pages). Laid
// over the shared tree by `make sync-site`, replacing public/config.js — the
// only file that differs between the two deployments.
window.PENALTY_CONFIG = {
  mode: "public",
  // api-shim.js overrides fetch() and serves /api/* from the exported JSON
  static: true,
  // no row-level data on the public site: aggregates and model outputs only
  rowLevel: false,
  brand: "Penalty statistics",
  // the central hub every exported screenshot points back to ({hub} in copy.js)
  hub: "maxoosterwegel.com",
  nav: ["takers", "keepers", "compare", "shootout", "heatmap", "models", "about"],
  // Cookie-less hit counting (analytics.js). Its own GoatCounter site, kept
  // separate from the blog's so the two don't share a path table (both have an
  // /about). Change the code here if the site is renamed.
  analytics: { goatcounter: "https://penaltystats.goatcounter.com/count" },
  // generic dataset wording — the public site doesn't name its sources
  srcEvent: "event data",
  srcArchive: "archive data",
  filteredLabel: "filtered archive",
  modelDataNote: "the filtered historical penalty archive",
  archiveSuffix: "",
};
