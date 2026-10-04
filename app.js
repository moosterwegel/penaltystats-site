// Takers/keepers dashboard, shared by both deployments (see config.js).
// Table-first: the full sortable/filterable leaderboard is the default view;
// clicking a row (or a search hit) opens that player's stat-tile card — except
// on the private dashboard, where it navigates to the dedicated shot-map page
// (shotmap-*.html + shotmap-app.js, the original private layout; config.js
// playerPages). The public site never ships those files — api-shim.js routes
// every /api call to the exported aggregate JSON instead.
//
// One script drives two dashboards. The page sets <body data-role="taker|keeper">
// and ROLE below maps that to the right endpoints, stat fields and labels:
//   taker  — penalties a player *took*  (scored / conversion / side taken)
//   keeper — penalties a goalkeeper *faced* (kept out / stop rate / dive direction)

const CFG = window.PENALTY_CONFIG || {};

const INK = "#16181d", INK2 = "#5c616b", INK3 = "#989ea9", LINE = "#d9dbe1";
// Canvas fonts mirror the CSS stack (styles.css): a humanist display face for
// headings/big numbers, IBM Plex Sans for the body. Keeps PNG exports on-brand.
const FONT_DISPLAY = '"Atkinson Hyperlegible", "Trebuchet MS", sans-serif';
const FONT_SANS = '"IBM Plex Sans", sans-serif';


// ---- role config -----------------------------------------------------------
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : null);
// Opta carries foot only for its own takers; fall back to the Transfermarkt
// profile so e.g. Transfermarkt-only players aren't shown as "foot unknown".
const footOf = (s) => cap(s.foot || (s.profile && s.profile.foot));

// Wording lives in copy.js; this spec only picks WHICH key each role uses.
const ROLE = document.body.dataset.role === "keeper" ? {
  id: "keeper",
  api: "keeper", list: "keepers",
  // API response field names (per dataset block). The headline "good" is `kept`
  // = penalties NOT scored (negation of is_goal), not strict saves — a missed or
  // posted penalty still wasn't a goal.
  count: "faced", good: "kept", soCount: "so_faced", soGood: "so_kept",
  // tile labels
  countLabel: T("card.countLabelKeeper"), rateLabel: T("card.rateLabelKeeper"),
  goodLabel: T("card.goodLabelKeeper"), soGoodLabel: T("card.soGoodKeeper"),
  personKey: "taker",
  meta: (s, src) => T("card.metaKeeper", { src }),
} : {
  id: "taker",
  api: "player", list: "players",
  count: "taken", good: "scored", soCount: "so_taken", soGood: "so_scored",
  countLabel: T("card.countLabelTaker"), rateLabel: T("card.rateLabelTaker"),
  goodLabel: T("card.goodLabelTaker"), soGoodLabel: T("card.soGoodTaker"),
  personKey: "gk",
  meta: (s, src) => T("card.metaTaker", {
    foot: footOf(s) ? T("card.footed", { foot: footOf(s) }) : T("card.footUnknown"),
    src,
  }),
};

// ---- state -----------------------------------------------------------------
let currentKey = null;
let currentStats = null;          // last selected subject's stats
let viewMode = "table";           // "table" (default) | "card"
let tableRows = null;             // cached aggregate table rows
let SKILL_AXIS = null;            // role-shared skill density x-grid (for the table half-eyes)
let WW_AXIS = null;               // same for the wrong-way skill columns
let MODEL_INFO = null;            // dataset/model figures for the export captions

const $ = (id) => document.getElementById(id);
const fmtPct = (n, d) => (d ? (100 * n / d).toFixed(1) + "%" : "–");

// ---- country flags ---------------------------------------------------------
// Zero-dependency, offline: map the data's country names to ISO-3166 alpha-2,
// then to a flag PNG mirrored under flags/ — never a CDN, since a third-party
// image hands the visitor's IP to that host on every render (the same reason
// the fonts are self-hosted). England/Scotland/Wales/N. Ireland use the GB
// subdivision codes; historical states / unmapped names show no flag.
const COUNTRY_ISO2 = {
  Brazil: "BR", Russia: "RU", France: "FR", "Türkiye": "TR", Turkey: "TR",
  England: "_ENG", Argentina: "AR", Ukraine: "UA", Spain: "ES", Italy: "IT",
  Germany: "DE", "Czech Republic": "CZ", Netherlands: "NL", Poland: "PL",
  Portugal: "PT", Austria: "AT", Serbia: "RS", Japan: "JP", Switzerland: "CH",
  "United States": "US", Norway: "NO", "Korea, South": "KR", Belgium: "BE",
  Belarus: "BY", Croatia: "HR", Denmark: "DK", Slovakia: "SK", Iran: "IR",
  Hungary: "HU", Scotland: "_SCO", Romania: "RO", Israel: "IL",
  "Bosnia-Herzegovina": "BA", Sweden: "SE", China: "CN", Greece: "GR",
  Estonia: "EE", Finland: "FI", Colombia: "CO", Ireland: "IE", Nigeria: "NG",
  Algeria: "DZ", Wales: "_WAL", Bulgaria: "BG", Uruguay: "UY", Egypt: "EG",
  Morocco: "MA", Slovenia: "SI", Mexico: "MX", Albania: "AL", "South Africa": "ZA",
  Kazakhstan: "KZ", Tunisia: "TN", Georgia: "GE", Iceland: "IS", Chile: "CL",
  Ghana: "GH", Peru: "PE", "Northern Ireland": "_NIR", Montenegro: "ME",
  Australia: "AU", Paraguay: "PY", Uzbekistan: "UZ", Latvia: "LV",
  Lithuania: "LT", Malta: "MT", Senegal: "SN", Hongkong: "HK", "Costa Rica": "CR",
  Ecuador: "EC", Armenia: "AM", "North Macedonia": "MK", Venezuela: "VE",
  Thailand: "TH", "Saudi Arabia": "SA", Luxembourg: "LU", "Cote d'Ivoire": "CI",
  Cameroon: "CM", Jamaica: "JM", Kosovo: "XK", Moldova: "MD", "Faroe Islands": "FO",
  Indonesia: "ID", Canada: "CA", "El Salvador": "SV", Azerbaijan: "AZ",
  Panama: "PA", Vietnam: "VN", "DR Congo": "CD", Honduras: "HN", "New Zealand": "NZ",
  India: "IN", Cyprus: "CY", Mali: "ML", Bolivia: "BO", Iraq: "IQ",
  "United Arab Emirates": "AE", Guinea: "GN", Guatemala: "GT", Kyrgyzstan: "KG",
  Malaysia: "MY", "Cape Verde": "CV", Tajikistan: "TJ", Singapore: "SG",
  Qatar: "QA", Uganda: "UG", "Trinidad and Tobago": "TT", Lebanon: "LB",
  Angola: "AO", "Burkina Faso": "BF", Libya: "LY", Haiti: "HT", Zimbabwe: "ZW",
  "The Gambia": "GM", Congo: "CG", "San Marino": "SM", Bangladesh: "BD",
  Jordan: "JO", "Puerto Rico": "PR", Gibraltar: "GI", Laos: "LA", Andorra: "AD",
  Guadeloupe: "GP", Zambia: "ZM", "Guinea-Bissau": "GW", Myanmar: "MM", Oman: "OM",
  Suriname: "SR", Curacao: "CW", Palestine: "PS", Fiji: "FJ", Togo: "TG",
  Martinique: "MQ", Philippines: "PH", Nicaragua: "NI", "Chinese Taipei": "TW",
  "Dominican Republic": "DO", Kenya: "KE", Gabon: "GA", Benin: "BJ",
  Ethiopia: "ET", Syria: "SY", Liberia: "LR", "Sierra Leone": "SL",
  Turkmenistan: "TM", Comoros: "KM", Madagascar: "MG", Cuba: "CU", Sudan: "SD",
  Cambodia: "KH", Tanzania: "TZ", Bahrain: "BH", "New Caledonia": "NC",
  Afghanistan: "AF", Mauritania: "MR", "French Guiana": "GF", "Solomon Islands": "SB",
  Rwanda: "RW", Tahiti: "PF", Burundi: "BI", "Equatorial Guinea": "GQ",
  Grenada: "GD", "Central African Republic": "CF", Liechtenstein: "LI",
  Niger: "NE", Vanuatu: "VU", Kuwait: "KW", Mozambique: "MZ", Namibia: "NA",
  "Sri Lanka": "LK", Guyana: "GY", "St. Kitts & Nevis": "KN",
  "Antigua and Barbuda": "AG", Belize: "BZ", "Korea, North": "KP", Barbados: "BB",
  Aruba: "AW", Chad: "TD", "Brunei Darussalam": "BN", "Papua New Guinea": "PG",
  Botswana: "BW", Malawi: "MW", "St. Vincent & Grenadinen": "VC", Nepal: "NP",
  Somalia: "SO", Bhutan: "BT", "Southern Sudan": "SS", "St. Lucia": "LC",
  "Timor-Leste": "TL", Tonga: "TO", Mauritius: "MU", Maldives: "MV", Samoa: "WS",
  Yemen: "YE", "Saint-Martin": "MF", Pakistan: "PK", "Réunion": "RE",
  Djibouti: "DJ", "Sao Tome and Principe": "ST", Eswatini: "SZ",
  "American Virgin Islands": "VI", "British Virgin Islands": "VG", Bermuda: "BM",
  Anguilla: "AI", Bonaire: "BQ", Eritrea: "ER", "Cayman Islands": "KY",
  "American Samoa": "AS", Bahamas: "BS", Mongolia: "MN", Lesotho: "LS", Guam: "GU",
  Macao: "MO", Dominica: "DM", Montserrat: "MS", "Sint Maarten": "SX",
  Seychelles: "SC", Mayotte: "YT", "Northern Mariana Islands": "MP", Tuvalu: "TV",
  Kiribati: "KI", Jersey: "JE", "Isle of Man": "IM", Guernsey: "GG",
  "Marshall Islands": "MH", Monaco: "MC", "Cookinseln": "CK",
  "Turks- and Caicosinseln": "TC",
};
// Two heights are mirrored (flags/README.md): h24 for the HTML <img>, drawn at
// 12px so it stays sharp on retina, and h40 for the canvas export.
const _GB_SUBDIV = { _ENG: "gb-eng", _SCO: "gb-sct", _WAL: "gb-wls", _NIR: "gb-nir" };
function flagCode(country) {
  const code = country && COUNTRY_ISO2[country];
  if (!code) return null;
  return _GB_SUBDIV[code] || code.toLowerCase();
}
function flagUrl(country, h = 24) {
  const c = flagCode(country);
  return c ? `flags/h${h}/${c}.png` : null;
}
function flagImg(country, cls = "flag") {
  const u = flagUrl(country);
  return u ? `<img class="${cls}" src="${u}" alt="" loading="lazy">` : "";
}
// "<flag> Name" for HTML (name escaped); just the name when there's no flag.
function withFlag(country) {
  if (!country) return "";
  return flagImg(country) + esc(country);     // gap comes from .flag margin
}
// Load a flag bitmap for the PNG export. Same-origin now, so the canvas stays
// untainted without CORS; resolves null on any failure so export still works.
function loadFlagImage(country) {
  const u = flagUrl(country, 40);
  if (!u) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = u;
  });
}
// Nation shown for a subject (national team, else citizenship).
const nationOf = (s) => s.profile && (s.profile.national_team || s.profile.citizenship);


// ---- search combobox -------------------------------------------------------
const search = $("search"), results = $("results");
let activeIdx = -1;

async function runSearch(q) {
  const list = await fetch(`/api/${ROLE.list}?q=${encodeURIComponent(q)}`).then((r) => r.json());
  results.innerHTML = "";
  activeIdx = -1;
  list.forEach((p) => {
    const li = document.createElement("li");
    const n = p.taken ?? p.faced;             // count key differs by role
    // hint (nationality · birth year) tells same-name players apart now that
    // they are separate subjects
    li.innerHTML = `<span>${p.name}${p.hint ? ` <small class="cnt">${p.hint}</small>` : ""}</span>` +
      `<span class="cnt">${T("card.searchCount", { n })}</span>`;
    li.onclick = () => selectSubject(p.key);
    results.appendChild(li);
  });
  results.classList.toggle("hidden", list.length === 0);
}

let searchTimer;
search.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => runSearch(search.value), 110);
});
search.addEventListener("focus", () => { if (!search.value) runSearch(""); });
search.addEventListener("keydown", (e) => {
  const items = [...results.children];
  if (e.key === "ArrowDown") activeIdx = Math.min(activeIdx + 1, items.length - 1);
  else if (e.key === "ArrowUp") activeIdx = Math.max(activeIdx - 1, 0);
  else if (e.key === "Enter" && activeIdx >= 0) { items[activeIdx].click(); return; }
  else if (e.key === "Escape") { results.classList.add("hidden"); return; }
  else return;
  items.forEach((it, i) => it.classList.toggle("active", i === activeIdx));
  items[activeIdx]?.scrollIntoView({ block: "nearest" });
  e.preventDefault();
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".combo")) results.classList.add("hidden");
});

// ---- subject selection -----------------------------------------------------
// The table is the entry point; clicking a row (or a search hit) opens the
// player card in place.
async function selectSubject(key, { card = false } = {}) {
  // The private dashboard has a dedicated shot-map page per role (the original
  // rail + tiles + goal-mouth layout, config.js playerPages); picking a player
  // goes there. The public site opens the stat-tile card in place instead.
  // `card: true` (the ?p= deep link) opens the card on BOTH deployments —
  // that's how the shot map's "more info" button reaches the card privately,
  // making the shot map the page between the table and the player card.
  if (CFG.playerPages && !card) {
    location.href = `${CFG.playerPages[ROLE.id]}?p=${encodeURIComponent(key)}`;
    return;
  }
  const stats = await fetch(`/api/${ROLE.api}/${key}`).then((r) => r.json());
  search.value = "";
  results.classList.add("hidden");
  currentKey = key;
  currentStats = stats;

  renderCardHead(stats);
  renderTiles(stats);
  setView("card");
}

// Source labels for the two datasets behind the counts: the detailed event
// feed (placement-era, 2009-) vs the broad historical archive (1990-). The
// private dashboard names them (Opta/Transfermarkt), the public site keeps
// them generic — config.js decides.
const SRC_EVENT = CFG.srcEvent || "event data";
const SRC_ARCHIVE = CFG.srcArchive || "archive data";

function renderCardHead(s) {
  const url = flagUrl(nationOf(s));
  $("cardName").innerHTML = (url ? `<img class="flag flag-name" src="${url}" alt="">` : "") + esc(s.name);
  const hasOpta = s.opta[ROLE.count] > 0;
  const src = T(hasOpta && s.tm ? "card.srcBoth"
    : hasOpta ? "card.srcEventOnly" : "card.srcArchiveOnly");
  $("cardMeta").textContent = ROLE.meta(s, src);
  const snap = $("cardSnap");
  if (snap) { snap.hidden = false; snap.onclick = exportCardPng; }
}

// ---- player profile (a tile on the card) ------------------------------------
// The public export carries a reduced profile: position, citizenship,
// national team, foot, status, world_cup.
function profileTile(p) {
  if (!p) return "";
  const nat = p.national_team || p.citizenship;
  const rows = [
    [T("card.status"), p.status],
    [T("card.club"), p.club],
    [T("card.position"), p.position],
    [T("card.foot"), cap(p.foot)],
    [T("card.nation"), nat ? withFlag(nat) : null],
  ].filter(([, v]) => v);
  if (!rows.length && !p.world_cup) return "";
  const wcBadge = p.world_cup ? `<div class="profile-badge">${T("card.worldCup")}</div>` : "";
  return `<div class="tile tile-profile"><div class="t-label">${T("card.profile")}</div>` + wcBadge +
    `<dl class="profile">` +
    rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("") +
    `</dl></div>`;
}

// ---- penalty-skill posterior (top-bar tile) --------------------------------
// A compact "half-eye": the posterior density of the subject's skill effect over
// a role-shared axis, with a 95% interval bar + median dot; 0 = global average.
// Mirrors the blog's skill distribution. Takers read as added scoring
// probability (higher = better); for keepers we flip the sign so the axis reads
// as shot-stopping skill (a better keeper lowers the opponent's scoring).
const SKILL_LABEL = T(ROLE.id === "keeper" ? "card.skillKeeper" : "card.skillTaker");
// The wrong-way companion model (gk_wrong_way ~ (1|taker)+(1|gk), Opta subset
// with a recorded dive): takers deceive, keepers read. Same half-eye, same
// keeper sign-flip — + always reads as good (keeper dives the RIGHT way more).
const WW_LABEL = T(ROLE.id === "keeper" ? "card.wwKeeper" : "card.wwTaker");
const WW_TITLE = T(ROLE.id === "keeper" ? "card.wwTitleKeeper" : "card.wwTitleTaker");
const skSign = (v) => (v >= 0 ? "+" : "") + v.toFixed(1);

// Oriented geometry, shared by the on-screen SVG and the PNG-export canvas.
function skillGeom(sk) {
  const flip = ROLE.id === "keeper" ? -1 : 1;
  const pp = (v) => flip * v * 100;                 // effect in percentage points
  const med = pp(sk.median);
  const lo = Math.min(pp(sk.q025), pp(sk.q975));
  const hi = Math.max(pp(sk.q025), pp(sk.q975));
  // density grid -> oriented x in pp; flip reverses the slab so it still lines
  // up with the oriented axis.
  const d = sk.dens, n = d.n, xs = [], ys = d.y.slice();
  for (let i = 0; i < n; i++) xs.push(flip * (d.x_min + (d.x_max - d.x_min) * i / (n - 1)) * 100);
  if (flip < 0) { xs.reverse(); ys.reverse(); }
  return { xs, ys, lo, med, hi, good: med >= 0 };
}

// Axis extent (always includes 0) for a half-eye geometry.
function skillAxis(g) {
  const xmin = Math.min(g.xs[0], 0), xmax = Math.max(g.xs[g.xs.length - 1], 0);
  const padX = 0.04 * (xmax - xmin || 1);
  return { ax0: xmin - padX, ax1: xmax + padX };
}

function halfEyeSvg(g, { w = 172, h = 44, labels = true } = {}) {
  const { ax0, ax1 } = skillAxis(g);
  const sx = (x) => (x - ax0) / (ax1 - ax0) * w;
  const ymax = Math.max.apply(null, g.ys) || 1;
  // with labels, leave room under the baseline for the 'g' descender in "avg"
  const slabBase = labels ? h - 15 : h - 6, top = labels ? 4 : 1;
  const sy = (t) => slabBase - t / ymax * (slabBase - top);
  const ivY = labels ? h - 11 : h - 3;
  const fill = g.good ? "#3B9AB2" : "#C0392B";
  const slab = g.xs.map((x, i) => `${sx(x).toFixed(1)},${sy(g.ys[i]).toFixed(1)}`).join(" ");
  const lab = (v) => (v >= 0 ? "+" : "") + v.toFixed(0);
  const labelsSvg = labels
    ? `<text x="1" y="${h - 3}" class="he-x">${lab(ax0)}</text>` +
      `<text x="${sx(0).toFixed(1)}" y="${h - 3}" class="he-x" text-anchor="middle">avg</text>` +
      `<text x="${w - 1}" y="${h - 3}" class="he-x" text-anchor="end">${lab(ax1)}</text>`
    : "";
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" class="he">` +
    `<line x1="${sx(0).toFixed(1)}" y1="1" x2="${sx(0).toFixed(1)}" y2="${slabBase}" ` +
      `stroke="#b9b1a2" stroke-width="1" stroke-dasharray="2,2"/>` +
    `<polygon points="${sx(ax0).toFixed(1)},${slabBase} ${slab} ${sx(ax1).toFixed(1)},${slabBase}" ` +
      `fill="${fill}" fill-opacity="0.85" stroke="${fill}" stroke-width="0.7"/>` +
    `<line x1="${sx(g.lo).toFixed(1)}" y1="${ivY}" x2="${sx(g.hi).toFixed(1)}" y2="${ivY}" ` +
      `stroke="#2b2b2b" stroke-width="1.6"/>` +
    `<circle cx="${sx(g.med).toFixed(1)}" cy="${ivY}" r="2.2" fill="#1b1b1b"/>` +
    labelsSvg +
    `</svg>`;
}

// Build half-eye geometry for a table row from a role-shared axis + the row's
// downsampled density (or null when the subject isn't modelled). `p` picks the
// column family: "sk" (conversion skill) or "ww" (wrong-way skill).
function rowGeom(r, p, axis) {
  if (r[`${p}_median`] == null || !r[`${p}_dens`] || !axis) return null;
  return skillGeom({
    median: r[`${p}_median`], q025: r[`${p}_q025`], q975: r[`${p}_q975`],
    dens: { x_min: axis.x_min, x_max: axis.x_max, n: r[`${p}_dens`].length, y: r[`${p}_dens`] },
  });
}

// The model's baseline the effect is measured against: what the average taker
// does against the average keeper (score / send them the wrong way).
const skillBase = (sk) => T("card.skillBase", { p: (100 * sk.base_prob).toFixed(1) });
// The keeper tile reads as "dives the RIGHT way" (sign-flipped), so its anchor
// is the complement of the model's wrong-way intercept — quoting the wrong-way
// rate under a right-way tile made good keepers look anchored to a bad number.
const wwBase = (sk) => ROLE.id === "keeper"
  ? T("card.wwBaseKeeper", { p: (100 * (1 - sk.base_prob)).toFixed(1) })
  : T("card.wwBase", { p: (100 * sk.base_prob).toFixed(1) });
// PNG only: this baseline note is the widest line in a skill tile and overflows
// when the row is squeezed, so wrap it at the colon onto two lines for the export.
const baseLines = (b) => { const i = b.indexOf(": "); return i < 0 ? [b] : [b.slice(0, i + 1), b.slice(i + 2)]; };

// Percentile companion to the rank (rank 1 = best): "top 0.6%" for the front
// half of the field, "bottom X%" for the back half so it stays readable.
function pctlText(sk) {
  const p = (100 * sk.rank) / sk.n_ranked;
  const fmt = (v) => (v < 1 ? Math.max(v, 0.1).toFixed(1) : String(Math.round(v)));
  return p <= 50 ? T("card.pctlTop", { p: fmt(p) })
    : T("card.pctlBottom", { p: fmt(100 - p) });
}

// Stat-row tile carrying a half-eye + the headline numbers (penalty skill and
// the wrong-way estimate share the shape; only label/tooltip/baseline differ).
function eyeTile(sk, label, title, base, id) {
  if (!sk) return `<div class="tile"><div class="t-label">${label}</div>` +
    `<div class="t-empty">${T("card.notModelled")}</div></div>`;
  const g = skillGeom(sk);
  return `<div class="tile tile-skill"${id ? ` id="${id}"` : ""}${title ? ` title="${title}"` : ""}>` +
    `<div class="t-label">${label}${title ? " ⓘ" : ""}</div>` +
    `<div class="skill-eye">${halfEyeSvg(g, { w: 120, h: 46 })}</div>` +
    `<div class="t-sub"><b class="${g.good ? "sk-good" : "sk-bad"}">${skSign(g.med)} pp</b> ${T("card.vsGlobal")}</div>` +
    `<div class="t-note">${T("card.ciRank", {
      lo: skSign(g.lo), hi: skSign(g.hi), rank: sk.rank.toLocaleString(),
      of: sk.n_ranked.toLocaleString(), pctl: pctlText(sk),
    })}</div>` +
    `<div class="t-note">${base(sk)}</div></div>`;
}

const skillTile = (s) => eyeTile(s.skill, SKILL_LABEL, null, skillBase, "sk-marginal");
// No "Not modelled" placeholder for the wrong-way tile: most TM-only players
// aren't in the dive-direction subset, and the row is crowded enough.
const wwTile = (s) => (s.wrong_way ? eyeTile(s.wrong_way, WW_LABEL, WW_TITLE, wwBase) : "");

// ---- standardized estimand tiles --------------------------------------------
// The headline tile above shows the MARGINAL skill posterior; these two show
// the same posterior standardized to shootout kicks and to in-game penalties.
// They are derived client-side from the per-player RE draws + the fixed-effect
// draws (data/draws/… on the static site, /api/draws/… privately) — the same
// joint-posterior arithmetic the compare page and the simulator use, so no
// extra data ships. They render wherever the card renders: the public site's
// in-place card, and the private card reached via the shot map's "more info".
const plogis = (x) => 1 / (1 + Math.exp(-x));

const EST = [  // id, per-role label key, tooltip key, baseline copy key + field
  { id: "est-so", lab: "card.skillShootout", title: "card.estShootoutTitle",
    base: "card.estBaseSo", baseField: "base_prob_so" },
  { id: "est-ig", lab: "card.skillIngame", title: "card.estIngameTitle",
    base: "card.estBaseIg", baseField: "base_prob_ig" },
];
const estLabel = (e) => T(e.lab + (ROLE.id === "keeper" ? "Keeper" : "Taker"));

const estTilesHtml = (s) => (window.__shim && s.skill
  ? EST.map((e) => `<div class="tile tile-skill" id="${e.id}">` +
      `<div class="t-label">${estLabel(e)}</div>` +
      `<div class="t-empty">${T("common.loading")}</div></div>`).join("")
  : "");

let lastEst = null;  // per-estimand half-eye data, cached for the PNG export

async function fillEstimandTiles(key) {
  const els = EST.map((e) => $(e.id));
  if (!els.some(Boolean)) return;
  const kill = () => els.forEach((el) => el && el.remove());
  try {
    const [fe, r] = await Promise.all([
      window.__shim.fixedEffects(), window.__shim.rDraws(ROLE.id, key)]);
    if (!fe || !fe.b_so || !r) return kill();
    const n = Math.min(r.length, fe.b0.length);
    const draws = { "est-ig": new Array(n), "est-so": new Array(n) };
    for (let i = 0; i < n; i++) {
      const b0 = fe.b0[i], bs = b0 + fe.b_so[i];
      draws["est-ig"][i] = plogis(b0 + r[i]) - plogis(b0);
      draws["est-so"][i] = plogis(bs + r[i]) - plogis(bs);
    }
    const q = window.__shim.quantile;
    const stats = {};
    for (const id of Object.keys(draws)) {
      const s = [...draws[id]].sort((a, b) => a - b);
      stats[id] = { median: q(s, 0.5), q025: q(s, 0.025), q975: q(s, 0.975) };
    }
    // one grid for both tiles so the two slabs compare at a glance (same
    // trimming idea as the exported role-shared grids: CI extent + 4% pad)
    const gLo = Math.min(stats["est-ig"].q025, stats["est-so"].q025);
    const gHi = Math.max(stats["est-ig"].q975, stats["est-so"].q975);
    const pad = 0.04 * (gHi - gLo) || 1e-4;
    const x0 = gLo - pad, x1 = gHi + pad;
    lastEst = {};
    for (const e of EST) {
      const el = $(e.id);
      if (!el) continue;
      const sk = { ...stats[e.id],
        dens: { x_min: x0, x_max: x1, n: 128, y: window.__shim.kde(draws[e.id], x0, x1) } };
      const g = skillGeom(sk);
      lastEst[e.id] = { label: estLabel(e), geom: g,
                        base: T(e.base, { p: (100 * fe[e.baseField]).toFixed(1) }) };
      el.outerHTML = `<div class="tile tile-skill" id="${e.id}" title="${T(e.title)}">` +
        `<div class="t-label">${estLabel(e)} ⓘ</div>` +
        `<div class="skill-eye">${halfEyeSvg(g, { w: 120, h: 46 })}</div>` +
        `<div class="t-sub"><b class="${g.good ? "sk-good" : "sk-bad"}">${skSign(g.med)} pp</b> ${T("card.vsGlobal")}</div>` +
        `<div class="t-note">${T("card.ci", { lo: skSign(g.lo), hi: skSign(g.hi) })}</div>` +
        `<div class="t-note">${T(e.base, { p: (100 * fe[e.baseField]).toFixed(1) })}</div></div>`;
    }
    // the headline tile's tooltip can now quote the g-computation weight
    const m = $("sk-marginal");
    if (m && fe.w_shootout != null)
      m.title = T("card.skillTitle", { w: (100 * fe.w_shootout).toFixed(1) });
  } catch (e) {
    kill();
  }
}

function tile(label, value, sub) {
  return `<div class="tile"><div class="t-label">${label}</div>` +
    `<div class="t-value">${value}</div>` +
    (sub ? `<div class="t-sub">${sub}</div>` : "") + `</div>`;
}

// Dom/Mid/Non are the three side buckets, keyed to the taker's stronger foot;
// spelled out here (and in the export caption) so the abbreviations aren't cryptic.
const SIDE_ABBR = T("card.sideAbbr");
const DIVE_ABBR = T("card.diveAbbr");

// Generic split-bar tile (side-taken for takers, dive-direction for keepers).
function splitTile(label, parts, gParts, note, title) {
  const total = parts.reduce((a, p) => a + p.v, 0);
  if (!total) return `<div class="tile"><div class="t-label">${label}</div>` +
    `<div class="t-empty">${T("card.noPlacement")}</div></div>`;
  const gTotal = gParts.reduce((a, p) => a + p.v, 0) || 1;
  const pct = (v, t) => Math.round(100 * v / t);
  const bar = parts.map((p) => `<span style="width:${100 * p.v / total}%;background:${p.c}"></span>`).join("");
  const legend = parts.map((p) =>
    `<i><span class="sd" style="background:${p.c}"></span>${p.short} ${pct(p.v, total)}%</i>`).join("");
  const gStr = gParts.map((p) => pct(p.v, gTotal)).join("/");
  return `<div class="tile"${title ? ` title="${title}"` : ""}><div class="t-label">${label}${title ? " ⓘ" : ""}</div>` +
    `<div class="split-bar">${bar}</div>` +
    `<div class="split-legend">${legend}</div>` +
    `<div class="t-note">${T("card.splitGlobal", { note, split: gStr })}</div></div>`;
}

function sideTile(s) {
  const side = s.side, sg = s.side_global;
  // Global benchmark reads dominant-heavy, so call out where this player leans.
  const lean = T(side.Non_dominant > side.Dominant ? "card.leansNonDominant"
    : side.Centre >= side.Dominant && side.Centre >= side.Non_dominant ? "card.leansCentral"
    : "card.leansDominant");
  const parts = [
    { v: side.Dominant, c: "#0f766e", short: T("card.shortDominant") },
    { v: side.Centre, c: "#d98a0b", short: T("card.shortCentre") },
    { v: side.Non_dominant, c: "#a79f93", short: T("card.shortNonDominant") },
  ];
  const gParts = [
    { v: sg.Dominant }, { v: sg.Centre }, { v: sg.Non_dominant },
  ];
  // Left-footers' dominant side sits on the opposite half of the goal, so flip
  // the bar to read Non · Mid · Dom — the horizontal order then tracks the
  // goal-mouth plot below (keeper's left → right) for both feet.
  if (footOf(s) === "Left") { parts.reverse(); gParts.reverse(); }
  return splitTile(T("card.splitTaker"), parts, gParts, lean, SIDE_ABBR);
}

function diveTile(s) {
  const d = s.dive, gd = s.dive_global;
  // Relative to the shooter's foot, mirroring the taker placement split: did the
  // keeper dive to the shooter's dominant side, stay central, or go non-dominant?
  const parts = [
    { v: d.Dominant, c: "#0f766e", short: T("card.shortDominant") },
    { v: d.Centre, c: "#d98a0b", short: T("card.shortCentre") },
    { v: d.Non_dominant, c: "#a79f93", short: T("card.shortNonDominant") },
  ];
  const gParts = [{ v: gd.Dominant }, { v: gd.Centre }, { v: gd.Non_dominant }];
  return splitTile(T("card.splitKeeper"), parts, gParts,
    T("card.diveNote"), DIVE_ABBR);
}

// Selection numbers for a taker (or null): kicks taken (TM, the dataset the
// opportunity count comes from) over team penalties while on the pitch.
function takerSelection(s) {
  if (ROLE.id !== "taker" || !s.opps) return null;
  const taken = s.tm ? s.tm.taken : s.opta.taken;
  return { taken, opps: s.opps, pct: Math.min(100, Math.round(100 * taken / s.opps)) };
}

function renderTiles(s) {
  lastEst = null;  // stale estimand tiles must not leak into the next export
  const o = s.opta, t = s.tm;
  // The two datasets aren't subset/superset, so pick the *more complete* source
  // per subject for the headline counts.
  const head = (t && t[ROLE.count] >= o[ROLE.count]) ? t : o;
  const headSrc = head === t ? SRC_ARCHIVE : SRC_EVENT;
  const cnt = head[ROLE.count], good = head[ROLE.good];
  const soCnt = head[ROLE.soCount], soGood = head[ROLE.soGood];

  // Data-coverage note: on how many of the kicks we know where the ball
  // crossed the goal line (the event feed's placement subset).
  const denom = Math.max(o[ROLE.count], t ? t[ROLE.count] : 0);
  const placementNote = s.placement != null && denom
    ? `<div class="t-note">${T("card.placementNote", {
        n: s.placement, denom, p: fmtPct(s.placement, denom) })}</div>`
    : "";
  const penTile =
    `<div class="tile tile-num"><div class="t-label">${ROLE.countLabel}</div>` +
    `<div class="t-value">${cnt}</div>` +
    `<div class="t-sub"><b>${good}</b> ${ROLE.goodLabel}</div>` +
    `<div class="t-note">${headSrc}</div>` + placementNote + `</div>`;
  const splitHtml = ROLE.id === "keeper" ? diveTile(s) : sideTile(s);
  // Rate tile carries the global-average benchmark on its own note line.
  const rateTile =
    `<div class="tile tile-num"><div class="t-label">${ROLE.rateLabel}</div>` +
    `<div class="t-value">${fmtPct(good, cnt).replace("%", "")}<span class="unit">%</span></div>` +
    `<div class="t-sub">${good}/${cnt}</div>` +
    (s.rate_avg != null
      ? `<div class="t-note">${T("card.globalAvg", { p: s.rate_avg })}</div>` : "") +
    `</div>`;
  // Takers: how often they take when available — their kicks over their team's
  // penalties while they were on the pitch (lineup data, filtered competitions).
  const selInfo = takerSelection(s);
  const selTile = selInfo
    ? `<div class="tile"><div class="t-label">${T("card.chosen")}</div>` +
      `<div class="t-value">${selInfo.pct}<span class="unit">%</span></div>` +
      `<div class="t-sub">${T("card.chosenSub", {
        taken: selInfo.taken, opps: selInfo.opps })}</div>` +
      `<div class="t-note">${T("card.chosenNote")}</div></div>`
    : "";

  // Average PSxG vs actual scoring/conceding rate over the on-target kicks with
  // a recorded placement: the gap is what placement alone can't explain.
  const px = s.psxg;
  const psxgTitle = T(ROLE.id === "taker"
    ? "card.psxgTitleTaker" : "card.psxgTitleKeeper");
  const psxgTile = px
    ? `<div class="tile tile-num" title="${psxgTitle}"><div class="t-label">${T("card.psxg")}</div>` +
      `<div class="t-value sm">${Math.round(100 * px.mean)}<span class="unit">%</span></div>` +
      `<div class="t-sub">${T("card.psxgSub")}</div>` +
      `<div class="t-note">${T(ROLE.id === "taker"
        ? "card.psxgNoteTaker" : "card.psxgNoteKeeper", {
        p: Math.round(100 * px.goals / px.n_on_target), n: px.n_on_target,
      })}</div></div>`
    : "";

  $("statRow").innerHTML =
    penTile +
    rateTile +
    selTile +
    skillTile(s) +
    estTilesHtml(s) +
    wwTile(s) +
    `<div class="tile tile-num"><div class="t-label">${T("card.shootouts")}</div>` +
    `<div class="t-value sm">${soGood}<span class="unit">/${soCnt}</span></div>` +
    `<div class="t-sub">${fmtPct(soGood, soCnt)} ${ROLE.soGoodLabel}</div></div>` +
    splitHtml +
    psxgTile +
    profileTile(s.profile);
  fillEstimandTiles(currentKey);
}



const esc = (s) => (s == null ? "" : String(s).replace(/[&<>]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])));

// ---- table / player-card view switch -----------------------------------------
// The table is the default; the card replaces it in place when a row or a
// search hit is picked, with a back button to return.
function setView(mode) {
  viewMode = mode;
  document.querySelector(".stage").classList.toggle("hidden", mode !== "card");
  $("tableView").classList.toggle("hidden", mode !== "table");
  if (mode === "table") loadTable();
}

$("backToTable").onclick = () => setView("table");

// ---- aggregate table view --------------------------------------------------
// Skill columns (median + 95% interval, in pp) replace the Scored/Saved count to
// make room; the `skill` class keeps the numeric columns tight. Positions are
// abbreviated (full name in the tooltip) so the Opps/Sel% columns fit.
const POS_ABBR = {
  Goalkeeper: "GK", "Centre-Back": "CB", "Left-Back": "LB", "Right-Back": "RB",
  Sweeper: "SW", "Defensive Midfield": "DM", "Central Midfield": "CM",
  "Attacking Midfield": "AM", "Left Midfield": "LM", "Right Midfield": "RM",
  "Left Winger": "LW", "Right Winger": "RW", "Second Striker": "SS",
  "Centre-Forward": "CF", Attack: "FW", Midfield: "MF", Defender: "DF",
};
// TM positions read "Attack - Centre-Forward"; abbreviate the specific part.
const posAbbr = (p) => {
  if (!p) return null;
  const leaf = p.split(" - ").pop().trim();
  return POS_ABBR[leaf] || leaf;
};

// Club names lose their generic tokens ("FC Barcelona" -> "Barcelona",
// "Fluminense Football Club" -> "Fluminense"); anything still long is
// ellipsised by CSS with the full name in the tooltip.
const clubShort = (c) => {
  if (!c) return c;
  const s = c
    .replace(/\s+(Football|Foot-Ball|Futebol|Fútbol|Fußball|Balompié)[- ]?Club$/i, "")
    .replace(/\s+(FC|CF|AFC|SC|AC|CP|SK|FK|BK|IF|CD|SAD)\.?$/, "")
    .replace(/^(FC|CF|AFC|AC|SC|SK|FK|CD|CA|Club|1\.\s*FC)\s+/, "")
    .trim();
  return s || c;
};

const SUBJECT = T(ROLE.id === "keeper" ? "table.subjectKeepers" : "table.subjectTakers");
const WW_COL_LABEL = T(ROLE.id === "keeper" ? "table.colWwKeeper" : "table.colWwTaker");
// The league benchmark for a MODEL_INFO figure, tacked onto a column's tooltip so
// a keeper's dive record can be read against the average without widening the
// table. MODEL_INFO arrives async, hence the guard — and hence the header refresh
// where it lands, since the table may already be on screen by then.
const leagueAvg = (k) => (MODEL_INFO && MODEL_INFO[k] != null
  ? T("table.leagueAvgSuffix", { p: Math.round(100 * MODEL_INFO[k]) }) : "");
// A column's tooltip is a plain string, or a function of figures that load late.
const colTitle = (c) => (typeof c.title === "function" ? c.title() : c.title);
// Columns are grouped (group: "d" descriptives / "m" model estimates) for the
// extra header row; `fam: true` marks the first column of a model family and
// draws the separating border. Club and status share one column (status shown
// when there is no current club).
const keeperRole = ROLE.id === "keeper";
const TABLE_COLS = [
  { key: "name", label: T("table.colName"), type: "text", align: "left", group: "d" },
  { key: "foot", label: T("table.colFoot"), type: "select", taker: true, group: "d" },
  // keepers are all goalkeepers — the position column only earns its width for takers
  { key: "position", label: T("table.colPos"), type: "select", taker: true, group: "d" },
  { key: "club", label: T("table.colClub"), type: "text", align: "left", group: "d",
    title: T("table.titleClub") },
  // flag only, to save width — the filter still matches the country name and
  // the full name rides the cell tooltip
  { key: "team", label: T("table.colNat"), type: "text", group: "d", title: T("table.titleNat") },
  { key: "world_cup", label: T("table.colWc"), type: "bool", group: "d" },
  { key: "pens", label: T(keeperRole ? "table.colFaced" : "table.colPens"), type: "num", group: "d" },
  { key: "so", label: T("table.colShootouts"), type: "num", group: "d" },
  { key: "rate", label: T(keeperRole ? "table.colStop" : "table.colConv"), type: "num", group: "d" },
  { key: "dive_ok", label: T("table.colRightWay"), type: "num", keeper: true, group: "d",
    title: () => T("table.titleRightWay") + leagueAvg("gk_right_way") },
  { key: "dive_save", label: T("table.colSavedIfRight"), type: "num", keeper: true, group: "d",
    title: () => T("table.titleSavedIfRight") + leagueAvg("gk_save_if_right") },
  { key: "opps", label: T("table.colOpps"), type: "num", taker: true, group: "d",
    title: T("table.titleOpps") },
  { key: "sel", label: T("table.colSel"), type: "num", taker: true, group: "d",
    title: T("table.titleSel") },
  { key: "psxg", label: T("table.colPsxg"), type: "num", group: "m", fam: true,
    title: T(keeperRole ? "table.titlePsxgKeeper" : "table.titlePsxgTaker") },
  { key: "psxg_res", label: T("table.colVsExp"), type: "num", group: "m",
    title: T(keeperRole ? "table.titleVsExpKeeper" : "table.titleVsExpTaker") },
  { key: "skill_dist", label: T("table.colSkill"), type: "viz", skill: true, group: "m", fam: true,
    geom: (r) => rowGeom(r, "sk", SKILL_AXIS) },
  { key: "skill_med", label: T("table.colMed"), type: "num", skill: true, group: "m" },
  { key: "skill_lo", label: T("table.colLo"), type: "num", skill: true, group: "m" },
  { key: "skill_hi", label: T("table.colHi"), type: "num", skill: true, group: "m" },
  { key: "ww_dist", label: WW_COL_LABEL, type: "viz", skill: true, group: "m", fam: true,
    title: T(keeperRole ? "table.titleWwKeeper" : "table.titleWwTaker"),
    geom: (r) => rowGeom(r, "ww", WW_AXIS) },
  { key: "ww_med", label: T("table.colMed"), type: "num", skill: true, group: "m" },
  { key: "ww_lo", label: T("table.colLo"), type: "num", skill: true, group: "m" },
  { key: "ww_hi", label: T("table.colHi"), type: "num", skill: true, group: "m" },
].filter((c) => (!c.taker || ROLE.id === "taker") && (!c.keeper || ROLE.id === "keeper"));

const RENDER_CAP = 500;          // cap DOM rows; filters narrow the rest
let tableSort = { key: ROLE.id === "keeper" ? "pens" : "pens", dir: -1 };
const tableFilters = {};

async function loadTable() {
  if (!tableRows) {
    $("tableView").innerHTML = `<div class="table-loading">${T("table.loading")}</div>`;
    const resp = await fetch(`/api/${ROLE.list}/table`).then((r) => r.json());
    tableRows = resp.rows;
    SKILL_AXIS = resp.skill_axis;
    WW_AXIS = resp.ww_axis;
    // Orient the raw skill summaries into signed pp (keepers flipped, so higher
    // = better), rounded so the columns sort and read as shown. Both column
    // families (conversion skill, wrong-way skill) get the same treatment.
    const flip = ROLE.id === "keeper" ? -1 : 1;
    const r1 = (v) => Math.round(flip * v * 1000) / 10;
    for (const r of tableRows) {
      r.position_full = r.position;          // tooltip keeps the full TM label
      r.position = posAbbr(r.position);
      // club + status share one column: show the club, else a non-Active status
      if (!r.club && r.status && r.status !== "Active") r.club = r.status;
      r.club_full = r.club;                  // tooltip keeps the full club name
      r.club = clubShort(r.club);
      // the PSxG residual arrives in the taker's direction; flip for keepers
      // so positive = concedes less than placement predicts
      if (r.psxg_res != null && flip < 0) r.psxg_res = -r.psxg_res;
      if (r.sk_median != null) {
        r.skill_med = r1(r.sk_median);
        r.skill_lo = Math.min(r1(r.sk_q025), r1(r.sk_q975));
        r.skill_hi = Math.max(r1(r.sk_q025), r1(r.sk_q975));
      }
      if (r.ww_median != null) {
        r.ww_med = r1(r.ww_median);
        r.ww_lo = Math.min(r1(r.ww_q025), r1(r.ww_q975));
        r.ww_hi = Math.max(r1(r.ww_q025), r1(r.ww_q975));
      }
    }
    buildTableShell();
  }
  renderTableBody();
}

function uniqueVals(key) {
  return [...new Set(tableRows.map((r) => r[key]).filter((v) => v != null))].sort();
}

function buildTableShell() {
  const subj = SUBJECT;
  const famCls = (c) => (c.fam ? " fam" : "");
  // header alignment mirrors the cells: left for text, right for numbers,
  // centred for everything glyph-like (Foot, Pos, Nat, WC)
  const thCls = (c) =>
    (c.align === "left" ? "l" : c.type === "num" ? "num" : "c") +
    (c.skill ? " skill" : "") + famCls(c);
  // the extra header row groups columns into descriptives vs model estimates
  const groups = [];
  for (const c of TABLE_COLS) {
    const label = c.group === "m" ? "Model estimates" : "Descriptives";
    if (groups.length && groups[groups.length - 1].label === label) groups[groups.length - 1].span++;
    else groups.push({ label, span: 1 });
  }
  const groupCells = groups.map((g) =>
    `<th colspan="${g.span}" class="${g.label === "Model estimates" ? "fam" : ""}">${g.label}</th>`).join("");
  const headCells = TABLE_COLS.map((c) =>
    `<th data-key="${c.key}" class="${thCls(c)}"${c.title ? ` title="${colTitle(c)}"` : ""}>${c.label}` +
    (c.type === "viz" ? "" : `<span class="sort"></span>`) + `</th>`).join("");
  const filterCells = TABLE_COLS.map((c) => {
    if (c.type === "viz")
      return `<th class="skill${famCls(c)}"></th>`;
    if (c.type === "text")
      return `<th><input data-fk="${c.key}" type="text" placeholder="${T("table.filterText")}" /></th>`;
    if (c.type === "num")
      return `<th class="${(c.skill ? "num skill" : "num") + famCls(c)}"><input data-fk="${c.key}" type="number" placeholder="${T("table.filterMin")}" /></th>`;
    if (c.type === "bool")
      return `<th><label class="wc-chk"><input data-fk="${c.key}" type="checkbox" /></label></th>`;
    if (c.type === "select") {
      // derive options from the data so e.g. Transfermarkt's "Both" foot is filterable
      const opts = uniqueVals(c.key);
      return `<th><select data-fk="${c.key}"><option value="">${T("table.filterAll")}</option>` +
        opts.map((o) => `<option>${o}</option>`).join("") + `</select></th>`;
    }
    return "<th></th>";
  }).join("");

  $("tableView").innerHTML =
    `<div class="table-head">` +
    `<div class="table-title">All ${subj}</div>` +
    `<div class="table-sub" id="tableSub"></div>` +
    `<button class="btn-export table-export" id="exportTablePng">⤓ Screenshot table</button></div>` +
    `<div class="table-scroll"><table class="agg-table">` +
    `<thead><tr class="th-group">${groupCells}</tr>` +
    `<tr class="th-sort">${headCells}</tr><tr class="th-filter">${filterCells}</tr></thead>` +
    `<tbody id="aggBody"></tbody></table></div>`;

  $("tableView").querySelectorAll(".th-sort th").forEach((th) => {
    th.onclick = () => {
      const k = th.dataset.key;
      if (TABLE_COLS.find((c) => c.key === k)?.type === "viz") return;  // glyph column
      tableSort = { key: k, dir: tableSort.key === k ? -tableSort.dir : (k === "name" || k === "team" || k === "position" ? 1 : -1) };
      renderTableBody();
    };
  });
  $("tableView").querySelectorAll("[data-fk]").forEach((el) => {
    const ev = el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(ev, () => {
      tableFilters[el.dataset.fk] = el.type === "checkbox" ? el.checked : el.value;
      renderTableBody();
    });
  });
  $("exportTablePng").onclick = exportTablePng;
}

function filteredSortedRows() {
  let rows = tableRows.filter((r) => TABLE_COLS.every((c) => {
    const f = tableFilters[c.key];
    if (f == null || f === "" || f === false) return true;
    const v = r[c.key];
    if (c.type === "num") return (v || 0) >= Number(f);
    if (c.type === "bool") return !!v;
    if (c.type === "select") return String(v ?? "") === f;
    // the club column doubles as the status filter: it shows the club for
    // active players and the status otherwise, so "retired" already works —
    // typing "active" matches everyone who currently HAS a club
    if (c.key === "club" && String(f).trim().toLowerCase() === "active")
      return r.status === "Active";
    return String(v ?? "").toLowerCase().includes(String(f).toLowerCase());
  }));
  const { key, dir } = tableSort;
  rows.sort((a, b) => {
    const x = a[key], y = b[key];
    if (typeof x === "number" || typeof y === "number") {
      // rows without a value (e.g. unmodelled players in the skill columns)
      // always sink to the bottom, whichever way the sort points — coercing
      // null to 0 would park them mid-table between the below- and
      // above-average players
      if (x == null) return y == null ? 0 : 1;
      if (y == null) return -1;
      return (x - y) * dir;
    }
    return String(x ?? "").localeCompare(String(y ?? "")) * dir;
  });
  return rows;
}

function renderTableBody() {
  const rows = filteredSortedRows();
  const shown = rows.slice(0, RENDER_CAP);
  $("aggBody").innerHTML = shown.map((r) => {
    const cells = TABLE_COLS.map((c) => {
      if (c.key === "world_cup")
        return `<td class="c">${r.world_cup ? "🏆" : ""}</td>`;
      if (c.key === "rate")
        return `<td class="num">${r.rate}%</td>`;
      if (c.key === "sel")
        return `<td class="num">${r.sel == null ? "–" : r.sel + "%"}</td>`;
      if (c.key === "dive_ok" || c.key === "dive_save")
        return `<td class="num">${r[c.key] == null ? "–" : r[c.key] + "%"}</td>`;
      if (c.key === "psxg")
        return `<td class="num fam">${r.psxg == null ? "–" : r.psxg.toFixed(2)}</td>`;
      if (c.key === "psxg_res")
        return `<td class="num">${r.psxg_res == null ? "–" : (r.psxg_res >= 0 ? "+" : "") + r.psxg_res.toFixed(2)}</td>`;
      if (c.key === "position")
        return `<td class="c" title="${esc(r.position_full) || ""}">${esc(r.position) || "–"}</td>`;
      if (c.key === "club")
        return `<td class="ell" title="${esc(r.club_full) || ""}">${esc(r.club) || "–"}</td>`;
      if (c.key === "team")
        return `<td class="c" title="${esc(r.team) || ""}">${r.team ? flagImg(r.team) || esc(r.team) : "–"}</td>`;
      if (c.type === "viz") {
        const geom = c.geom(r);
        return `<td class="skill dist${c.fam ? " fam" : ""}">${geom ? halfEyeSvg(geom, { w: 118, h: 22, labels: false }) : "–"}</td>`;
      }
      if (c.skill) {
        const v = r[c.key];
        return `<td class="num skill">${v == null ? "–" : (v >= 0 ? "+" : "") + v.toFixed(1)}</td>`;
      }
      const cls = c.type === "num" ? "num" : (c.align === "left" ? "" : "c");
      return `<td class="${cls}">${esc(r[c.key]) || (c.type === "num" ? 0 : "–")}</td>`;
    }).join("");
    return `<tr data-key="${esc(r.key)}">${cells}</tr>`;
  }).join("");
  $("tableSub").textContent =
    T("table.count", { n: rows.length.toLocaleString(), subject: SUBJECT }) +
    (rows.length > RENDER_CAP ? T("table.truncated", { cap: RENDER_CAP }) : "");
  $("aggBody").querySelectorAll("tr").forEach((tr) => {
    tr.onclick = () => selectSubject(tr.dataset.key);
  });
  // reflect current sort direction in the header (the glyph column has no .sort)
  $("tableView").querySelectorAll(".th-sort th").forEach((th) => {
    const span = th.querySelector(".sort");
    if (span) span.textContent =
      th.dataset.key === tableSort.key ? (tableSort.dir < 0 ? " ↓" : " ↑") : "";
  });
}

// ---- table PNG export helpers -----------------------------------------------
// The half-eye, drawn onto the export canvas (mirrors halfEyeSvg). x/y is the
// slab's top-left; P scales to the 2x export.
function drawHalfEyeCanvas(ctx, x, y, w, h, g, P) {
  const { ax0, ax1 } = skillAxis(g);
  const sx = (v) => x + (v - ax0) / (ax1 - ax0) * w;
  const ymax = Math.max.apply(null, g.ys) || 1;
  const base = y + h, top = y;
  const sy = (t) => base - t / ymax * (base - top);
  ctx.strokeStyle = "#b9b1a2"; ctx.lineWidth = P(0.8); ctx.setLineDash([P(2), P(2)]);
  ctx.beginPath(); ctx.moveTo(sx(0), top); ctx.lineTo(sx(0), base); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(sx(ax0), base);
  g.xs.forEach((v, i) => ctx.lineTo(sx(v), sy(g.ys[i])));
  ctx.lineTo(sx(ax1), base); ctx.closePath();
  ctx.fillStyle = g.good ? "#3B9AB2" : "#C0392B";
  ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
  const ivY = base + P(4);
  ctx.strokeStyle = "#2b2b2b"; ctx.lineWidth = P(1.6);
  ctx.beginPath(); ctx.moveTo(sx(g.lo), ivY); ctx.lineTo(sx(g.hi), ivY); ctx.stroke();
  ctx.fillStyle = "#1b1b1b";
  ctx.beginPath(); ctx.arc(sx(g.med), ivY, P(2.2), 0, 2 * Math.PI); ctx.fill();
}

// ---- export captions -------------------------------------------------------
// Greedy word-wrap of a string to `maxW` px at the context's current font.
function wrapText(ctx, text, maxW) {
  const words = text.split(" "), lines = [];
  let line = "";
  for (const w of words) {
    const tryLine = line ? line + " " + w : w;
    if (line && ctx.measureText(tryLine).width > maxW) { lines.push(line); line = w; }
    else line = tryLine;
  }
  if (line) lines.push(line);
  return lines;
}


// The caption every screenshot carries: the shared sentences from copy.js, in
// the order they read as a paragraph. Only the export-specific lines live in
// the exports themselves.
function modelCaption(mi, keeper) {
  const thru = (d) => (d ? T("caption.through", { date: d }) : "");
  let s = T("caption.skill", {
    skill: T(keeper ? "card.skillKeeper" : "card.skillTaker"),
    estimand: T(keeper ? "caption.estimandKeeper" : "caption.estimandTaker"),
  });
  if (mi && mi.n_pen != null) {
    s += " " + T("caption.fit", {
      n: mi.n_pen.toLocaleString(), through: thru(mi.tm_latest) });
    s += (mi.n_taker && mi.n_gk)
      ? T("caption.covering", {
          takers: mi.n_taker.toLocaleString(), keepers: mi.n_gk.toLocaleString() })
      : ".";
  }
  return s + " " + T("caption.pp") + " " + T("caption.more");
}

// ---- export a PNG "screenshot" of the aggregate table ----------------------
// Renders the *currently filtered + sorted* rows to a canvas (not the live DOM),
// so the image carries the same fonts, half-eye sparklines and flags as the rest
// of the app and stays crisp. Capped so a wide-open table doesn't make a
// 10,000-row image; filter to narrow, then export.
const TABLE_EXPORT_CAP = 60;
async function exportTablePng() {
  if (!tableRows) return;
  const allRows = filteredSortedRows();
  const rows = allRows.slice(0, TABLE_EXPORT_CAP);
  if (!rows.length) return;
  const truncated = allRows.length > TABLE_EXPORT_CAP;
  const subj = ROLE.id === "keeper" ? "goalkeepers" : "takers";
  const SC = 2, P = (v) => v * SC;

  // Preload the flags used in the National-team column (null when offline).
  const nations = [...new Set(rows.map((r) => r.team).filter(Boolean))];
  const flags = new Map();
  await Promise.all(nations.map((n) => loadFlagImage(n).then((img) => flags.set(n, img))));

  // A row's text for a given column (mirrors renderTableBody, sans markup).
  const cellText = (r, c) =>
    c.key === "world_cup" ? (r.world_cup ? "🏆" : "")
    : c.key === "rate" ? r.rate + "%"
    : c.key === "sel" ? (r.sel == null ? "–" : r.sel + "%")
    : c.key === "dive_ok" || c.key === "dive_save" ? (r[c.key] == null ? "–" : r[c.key] + "%")
    : c.key === "psxg" ? (r.psxg == null ? "–" : r.psxg.toFixed(2))
    : c.key === "psxg_res" ? (r.psxg_res == null ? "–" : (r.psxg_res >= 0 ? "+" : "") + r.psxg_res.toFixed(2))
    : c.key === "team" ? (r.team && flags.get(r.team) ? "" : (r.team || "–"))
    : c.key === "club" ? (r.club ? (r.club.length > 24 ? r.club.slice(0, 23) + "…" : r.club) : "–")
    : c.skill ? (r[c.key] == null ? "–" : (r[c.key] >= 0 ? "+" : "") + r[c.key].toFixed(1))
    : r[c.key] == null ? "–" : String(r[c.key]);

  // ---- column geometry: measure text at base size, viz column is fixed ----
  const meas = document.createElement("canvas").getContext("2d");
  const CELL = 13, HEAD = 10, FLAGW = 17;          // base px
  const colW = TABLE_COLS.map((c) => {
    if (c.type === "viz") return 126;
    meas.font = `${HEAD}px ${FONT_SANS}`;
    let w = meas.measureText(c.label).width;
    meas.font = `${CELL}px ${FONT_SANS}`;
    for (const r of rows) {
      const extra = c.key === "team" && r.team && flags.get(r.team) ? FLAGW : 0;
      w = Math.max(w, meas.measureText(cellText(r, c)).width + extra);
    }
    return Math.ceil(w);
  });
  const align = TABLE_COLS.map((c) =>
    c.type === "num" ? "right"
    : (c.type === "viz" || c.key === "world_cup" || c.key === "team") ? "center" : "left");

  const padX = 24, gut = 16, rowH = 26, headH = 30, titleH = 76, footLineH = 14;
  const tableW = colW.reduce((a, w) => a + w + gut, 0) - gut;
  const W = padX * 2 + tableW;
  // Footer caption (model note + blog link), word-wrapped to the table width.
  const rateLbl = T(keeperRole ? "table.colStop" : "table.colConv");
  const mi = MODEL_INFO;
  const globalAvg = mi && (ROLE.id === "keeper" ? mi.global_kept : mi.global_conv);
  const footCap = modelCaption(mi, keeperRole);
  meas.font = `10.5px ${FONT_SANS}`;
  const footLines = wrapText(meas, footCap, W - 2 * padX);
  const footH = footLines.length * footLineH + 12;
  const H = titleH + headH + rows.length * rowH + footH;
  const colX = [];                                  // left edge of each column
  for (let i = 0, x = padX; i < colW.length; i++) { colX.push(x); x += colW[i] + gut; }
  const anchor = (i) => align[i] === "right" ? colX[i] + colW[i]
    : align[i] === "center" ? colX[i] + colW[i] / 2 : colX[i];

  const out = document.createElement("canvas");
  out.width = Math.round(P(W)); out.height = Math.round(P(H));
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, out.width, out.height);

  // ---- title block ----
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK; ctx.font = `700 ${P(22)}px ${FONT_DISPLAY}`;
  ctx.fillText(T("table.pngTitle", { subject: subj }), P(padX), P(34));
  ctx.fillStyle = INK3; ctx.font = `${P(12)}px ${FONT_SANS}`;
  ctx.fillText(T("table.count", { n: allRows.length.toLocaleString(), subject: subj }) +
    (truncated ? T("table.truncated", { cap: TABLE_EXPORT_CAP }) : ""), P(padX), P(50));
  if (globalAvg != null) {
    ctx.fillStyle = INK2; ctx.font = `${P(11.5)}px ${FONT_SANS}`;
    ctx.fillText(T("table.pngGlobalAvg", { label: rateLbl, p: globalAvg }), P(padX), P(67));
  }

  // ---- header row ----
  let y = titleH;
  ctx.fillStyle = INK3; ctx.font = `${P(HEAD)}px ${FONT_SANS}`; ctx.textBaseline = "middle";
  TABLE_COLS.forEach((c, i) => {
    ctx.textAlign = align[i];
    ctx.fillText(c.label.toUpperCase(), P(anchor(i)), P(y + headH / 2));
  });
  ctx.strokeStyle = LINE; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(P(padX), P(y + headH) - 0.5); ctx.lineTo(P(W - padX), P(y + headH) - 0.5); ctx.stroke();

  // ---- data rows (zebra-striped, like the live hover ground) ----
  y += headH;
  rows.forEach((r, ri) => {
    const ry = y + ri * rowH, mid = P(ry + rowH / 2);
    if (ri % 2) { ctx.fillStyle = "#f3f4f6"; ctx.fillRect(P(padX - 6), P(ry), P(tableW + 12), P(rowH)); }
    TABLE_COLS.forEach((c, i) => {
      if (c.type === "viz") {
        const g = c.geom(r);
        if (g) drawHalfEyeCanvas(ctx, P(colX[i]), P(ry + 4), P(colW[i]), P(11), g, P);
        else { ctx.fillStyle = INK3; ctx.font = `${P(CELL)}px ${FONT_SANS}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("–", P(colX[i] + colW[i] / 2), mid); }
        return;
      }
      ctx.font = `${P(CELL)}px ${FONT_SANS}`; ctx.textBaseline = "middle"; ctx.textAlign = align[i];
      let tx = anchor(i);
      if (c.key === "team" && r.team && flags.get(r.team)) {
        // flag only, centred — cellText is empty for flagged rows
        const img = flags.get(r.team), fh = 12, fw = fh * (img.width / img.height);
        ctx.drawImage(img, P(colX[i] + (colW[i] - fw) / 2), mid - P(fh) / 2, P(fw), P(fh));
      }
      ctx.fillStyle = i === 0 ? INK : c.skill ? INK2 : INK;
      ctx.fillText(cellText(r, c), P(tx), mid);
    });
  });

  // ---- footer note (model description + blog link, wrapped above) ----
  const fy = y + rows.length * rowH;
  ctx.strokeStyle = LINE; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(P(padX), P(fy) + 0.5); ctx.lineTo(P(W - padX), P(fy) + 0.5); ctx.stroke();
  ctx.fillStyle = INK3; ctx.font = `${P(10.5)}px ${FONT_SANS}`; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  footLines.forEach((ln, i) => ctx.fillText(ln, P(padX), P(fy + 13 + i * footLineH)));

  const a = document.createElement("a");
  a.href = out.toDataURL("image/png");
  a.download = `penalty-${subj}-table.png`;
  a.click();
}

// ---- export a PNG "screenshot" of the player card ---------------------------
// Same approach as the table export: re-render the tiles from their data on a
// canvas (crisp fonts, real half-eyes), never a DOM rasterise. Grid of fixed
// tile cells mirroring the on-screen stat row, name header above, model
// caption below.
const CARD_TILE_W = 226, CARD_TILE_H = 138, CARD_GAP = 16, CARD_COLS = 5;
// canvas fonts render the UI's icon glyphs (ⓘ, ⚽, 🏆) as tofu boxes — strip them
const plainTxt = (t) => String(t).replace(/[ⓘ⚽\u{1F3C6}\u{1F9E4}]/gu, "").trim();

async function exportCardPng() {
  const s = currentStats;
  if (!s || viewMode !== "card") return;
  const SC = 2, P = (v) => v * SC;
  const o = s.opta, t = s.tm;
  const head = (t && t[ROLE.count] >= o[ROLE.count]) ? t : o;
  const headSrc = head === t ? SRC_ARCHIVE : SRC_EVENT;
  const cnt = head[ROLE.count], good = head[ROLE.good];
  const denom = Math.max(o[ROLE.count], t ? t[ROLE.count] : 0);
  const selInfo = takerSelection(s);
  const px = s.psxg;

  const num = (label, value, sub, note) => ({ kind: "num", label, value, sub, note });
  const eye = (label, sk, base, geom) => ({ kind: "eye", label, base,
    geom: geom || skillGeom(sk),
    rank: sk && sk.rank != null
      ? `rank ${sk.rank.toLocaleString()}/${sk.n_ranked.toLocaleString()}` : null });

  // split segments, same orientation rule as the on-screen tile (left-footed
  // takers flip so the bar tracks the goal mouth)
  const sd = ROLE.id === "keeper" ? s.dive : s.side;
  const sg = ROLE.id === "keeper" ? s.dive_global : s.side_global;
  let split = null;
  if (sd) {
    const segs = [{ v: sd.Dominant, c: "#0f766e", k: T("card.shortDominant") },
                  { v: sd.Centre, c: "#d98a0b", k: T("card.shortCentre") },
                  { v: sd.Non_dominant, c: "#a79f93", k: T("card.shortNonDominant") }];
    const order = ["Dominant", "Centre", "Non_dominant"];
    if (ROLE.id === "taker" && footOf(s) === "Left") { segs.reverse(); order.reverse(); }
    const tot = segs.reduce((a, x) => a + x.v, 0);
    const gTot = sg ? Object.values(sg).reduce((a, x) => a + x, 0) : 0;
    if (tot) split = { kind: "split",
      label: T(ROLE.id === "keeper" ? "card.splitKeeper" : "card.splitTaker"),
      segs, tot,
      global: gTot ? T("shotmap.pngGlobalSplit", {
        split: order.map((k) => Math.round(100 * sg[k] / gTot)).join("/") }) : null };
  }

  const p = s.profile;
  const profile = p ? { kind: "profile", label: T("card.profile"), wc: p.world_cup,
    rows: [[T("card.status"), p.status], [T("card.club"), p.club],
           [T("card.position"), p.position], [T("card.foot"), cap(p.foot)],
           [T("card.nation"), p.national_team || p.citizenship]]
      .filter(([, v]) => v) } : null;

  const tiles = [
    num(ROLE.countLabel, String(cnt), `${good} ${ROLE.goodLabel}`,
        [headSrc, ...(s.placement != null && denom
          ? [T("card.placementNote", { n: s.placement, denom, p: fmtPct(s.placement, denom) })] : [])]),
    num(ROLE.rateLabel, fmtPct(good, cnt), `${good}/${cnt}`,
        s.rate_avg != null ? [T("card.globalAvg", { p: s.rate_avg })] : null),
    ...(selInfo ? [num(T("card.chosen"), selInfo.pct + "%",
        T("card.chosenSub", { taken: selInfo.taken, opps: selInfo.opps }),
        [T("card.chosenNote")])] : []),
    ...(s.skill ? [eye(SKILL_LABEL, s.skill, skillBase(s.skill))] : []),
    ...(lastEst ? EST.filter((e) => lastEst[e.id]).map((e) =>
        eye(lastEst[e.id].label, null, lastEst[e.id].base, lastEst[e.id].geom)) : []),
    ...(s.wrong_way ? [eye(WW_LABEL, s.wrong_way, wwBase(s.wrong_way))] : []),
    num(T("card.shootouts"), `${head[ROLE.soGood]}/${head[ROLE.soCount]}`,
        `${fmtPct(head[ROLE.soGood], head[ROLE.soCount])} ${ROLE.soGoodLabel}`),
    split,
    ...(px ? [num(T("card.psxg"), Math.round(100 * px.mean) + "%", T("card.psxgSub"),
        [T(ROLE.id === "taker" ? "card.psxgNoteTaker" : "card.psxgNoteKeeper",
           { p: Math.round(100 * px.goals / px.n_on_target), n: px.n_on_target })])] : []),
    profile,
  ].filter(Boolean);

  const nRows = Math.ceil(tiles.length / CARD_COLS);
  const padX = 26, headH = 92;
  const W = 2 * padX + CARD_COLS * CARD_TILE_W + (CARD_COLS - 1) * CARD_GAP;
  const meas = document.createElement("canvas").getContext("2d");
  meas.font = `${P(10.5)}px ${FONT_SANS}`;
  const capLines = wrapText(meas, modelCaption(MODEL_INFO, ROLE.id === "keeper"), P(W - 2 * padX));
  const gridH = nRows * CARD_TILE_H + (nRows - 1) * CARD_GAP;
  const H = headH + gridH + 26 + capLines.length * 15 + 16;

  const out = document.createElement("canvas");
  out.width = P(W); out.height = P(H);
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, out.width, out.height);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";

  // header: flag + name + meta line, hairline underneath
  let nameX = padX;
  const flagImg = await loadFlagImage(nationOf(s));
  if (flagImg) {
    const fh = P(24), fw = fh * (flagImg.width / flagImg.height);
    ctx.drawImage(flagImg, P(padX), P(40) - fh + P(2), fw, fh);
    nameX = padX + fw / SC + 10;
  }
  ctx.fillStyle = INK; ctx.font = `700 ${P(28)}px ${FONT_DISPLAY}`;
  ctx.fillText(s.name, P(nameX), P(40));
  ctx.fillStyle = INK2; ctx.font = `${P(12.5)}px ${FONT_SANS}`;
  ctx.fillText($("cardMeta").textContent, P(padX), P(60));
  ctx.strokeStyle = LINE; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(P(padX), P(74) + 0.5); ctx.lineTo(P(W - padX), P(74) + 0.5); ctx.stroke();

  tiles.forEach((tile, i) => {
    const x = padX + (i % CARD_COLS) * (CARD_TILE_W + CARD_GAP);
    const y = headH + Math.floor(i / CARD_COLS) * (CARD_TILE_H + CARD_GAP);
    // tile frame, like the on-screen cards
    ctx.strokeStyle = LINE; ctx.lineWidth = 1;
    ctx.strokeRect(P(x) + 0.5, P(y) + 0.5, P(CARD_TILE_W) - 1, P(CARD_TILE_H) - 1);
    const tx = x + 12;
    ctx.fillStyle = INK3; ctx.font = `${P(10.5)}px ${FONT_SANS}`;
    ctx.fillText(plainTxt(tile.label).toUpperCase(), P(tx), P(y + 20));

    if (tile.kind === "num") {
      ctx.fillStyle = INK; ctx.font = `700 ${P(26)}px ${FONT_DISPLAY}`;
      ctx.fillText(tile.value, P(tx), P(y + 52));
      if (tile.sub) {
        ctx.fillStyle = INK2; ctx.font = `${P(12)}px ${FONT_SANS}`;
        ctx.fillText(tile.sub, P(tx), P(y + 72));
      }
      ctx.fillStyle = INK3; ctx.font = `${P(10.5)}px ${FONT_SANS}`;
      [].concat(tile.note || []).forEach((n, k) =>
        ctx.fillText(n, P(tx), P(y + 89 + 14 * k)));
    } else if (tile.kind === "eye") {
      const w = CARD_TILE_W - 34;
      drawHalfEyeCanvas(ctx, P(tx), P(y + 28), P(w), P(24), tile.geom, P);
      ctx.fillStyle = tile.geom.good ? "#2f7d8a" : "#b23b2c";
      ctx.font = `600 ${P(13)}px ${FONT_SANS}`; ctx.textAlign = "left";
      ctx.fillText(`${skSign(tile.geom.med)} pp ${T("card.vsGlobal")}`, P(tx), P(y + 78));
      ctx.fillStyle = INK3; ctx.font = `${P(10.5)}px ${FONT_SANS}`;
      ctx.fillText(T("card.ci", { lo: skSign(tile.geom.lo), hi: skSign(tile.geom.hi) }),
        P(tx), P(y + 93));
      const lines = [...(tile.rank ? [tile.rank] : []), ...baseLines(tile.base || "")];
      lines.forEach((ln, k) => ctx.fillText(ln, P(tx), P(y + 107 + 13 * k)));
    } else if (tile.kind === "split") {
      const barW = CARD_TILE_W - 24, barY = y + 32, barH = 9;
      let cx2 = tx;
      for (const seg of tile.segs) {
        const w = barW * seg.v / tile.tot;
        ctx.fillStyle = seg.c; ctx.fillRect(P(cx2), P(barY), P(w), P(barH));
        cx2 += w;
      }
      ctx.fillStyle = INK2; ctx.font = `${P(10.5)}px ${FONT_SANS}`;
      ctx.fillText(tile.segs.map((seg) =>
        `${seg.k} ${Math.round(100 * seg.v / tile.tot)}%`).join(" · "), P(tx), P(barY + 24));
      if (tile.global) {
        ctx.fillStyle = INK3;
        ctx.fillText(tile.global, P(tx), P(barY + 40));
      }
    } else if (tile.kind === "profile") {
      let ry = y + 38;
      if (tile.wc) {
        ctx.fillStyle = "#0f766e"; ctx.font = `600 ${P(10.5)}px ${FONT_SANS}`;
        ctx.fillText(plainTxt(T("card.worldCup")), P(tx), P(ry)); ry += 16;
      }
      for (const [k, v] of tile.rows) {
        ctx.fillStyle = INK3; ctx.font = `${P(10.5)}px ${FONT_SANS}`; ctx.textAlign = "left";
        ctx.fillText(k, P(tx), P(ry));
        ctx.fillStyle = INK; ctx.textAlign = "right";
        ctx.fillText(String(v), P(x + CARD_TILE_W - 12), P(ry));
        ctx.textAlign = "left"; ry += 15;
      }
    }
  });

  const fy = headH + gridH + 12;
  ctx.strokeStyle = LINE; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(P(padX), P(fy) + 0.5); ctx.lineTo(P(W - padX), P(fy) + 0.5); ctx.stroke();
  ctx.fillStyle = INK3; ctx.font = `${P(10.5)}px ${FONT_SANS}`;
  capLines.forEach((ln, i) => ctx.fillText(ln, P(padX), P(fy + 16 + i * 15)));

  const slug = String(s.name).replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-|-$/g, "");
  const a = document.createElement("a");
  a.href = out.toDataURL("image/png");
  a.download = `penalty-${slug}.png`;
  a.click();
}

// ---- init ------------------------------------------------------------------
// Default view is the table; ?p=<key> deep-links straight to a player card
// (on the private dashboard too — table clicks go to the shot map instead).
const _params = new URLSearchParams(location.search);
if (_params.get("p")) selectSubject(_params.get("p"), { card: true }).catch(() => setView("table"));
else setView("table");
// Model/dataset figures for the export captions (non-blocking; exports fall back
// to a generic note if this hasn't arrived).
fetch("/api/model_info").then((r) => r.json()).then((m) => {
  MODEL_INFO = m;
  // data-version note in the navbar: latest kick in the data + cadence
  const el = $("phMeta");
  const latest = [m.tm_latest, m.ws_latest].filter(Boolean).sort().pop();
  if (el && latest) el.textContent = T("meta.dataThrough", { latest });
  // Tooltips that quote a league average were rendered before these figures
  // arrived, so give the headers their benchmark now (no re-render, no reflow).
  document.querySelectorAll("th[data-key]").forEach((th) => {
    const c = TABLE_COLS.find((x) => x.key === th.dataset.key);
    if (c && typeof c.title === "function") th.title = colTitle(c);
  });
}).catch(() => {});
