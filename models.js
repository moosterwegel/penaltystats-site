// Models page: per-model distribution of the posterior-median added
// probability across every modelled player (overlapping histograms + boxplot
// strips, the static twin of the blog's plot_skill_distribution) and the
// verbatim brms fit summaries from data/models.json.
"use strict";

const ROLE_META = {
  taker: { label: T("models.roleTaker"), color: "#78B7C5" },
  keeper: { label: T("models.roleKeeper"), color: "#E1AF00" },
};
const INK = "#1b1b1b", INK2 = "#4a4a48", INK3 = "#8b877d", LINE = "#e4e1d8";

// The prose (titles, axis captions, blurbs) lives in copy.js; a section is the
// copy keys plus the two values the fit supplies.
const SECTIONS = [
  { id: "conversion", title: "models.convTitle", xlabel: "models.convX", blurb: "models.convBlurb" },
  { id: "wrong_way",  title: "models.wwTitle",   xlabel: "models.wwX",   blurb: "models.wwBlurb" },
  { id: "psxg",       title: "models.psxgTitle",                         blurb: "models.psxgBlurb" },
];

const blurbOf = (spec, m, fe) => T(spec.blurb, {
  formula: esc(m.formula), n: m.n_obs.toLocaleString(),
  ...(fe && fe.w_shootout != null
    ? { w: (100 * fe.w_shootout).toFixed(1), ig: (100 * (1 - fe.w_shootout)).toFixed(1) }
    : {}),
});

const esc = (s) => (s == null ? "" : String(s).replace(/[&<>]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])));

const pp = (v) => (v >= 0 ? "+" : "") + (100 * v).toFixed(1);

function extremesLine(role, block) {
  const names = (xs) => xs.map((e) => `${esc(e.name)} (${pp(e.med)})`).join(", ");
  return `<p class="extremes">${T("models.extremes", {
    role: ROLE_META[role].label, n: block.n.toLocaleString(),
    high: names(block.high), low: names(block.low),
  })}</p>`;
}

// ---- the distribution figure -----------------------------------------------
// Overlapping count histograms (one per role, translucent), a dashed zero
// line, and per role a band with the labelled top/bottom-3 players over a
// boxplot strip whose outliers are drawn as dots. Shared pp x-axis.
function drawDist(canvas, model, xlabel) {
  const { x0, binw } = model.hist;
  const roles = Object.keys(model.roles).filter((r) => ROLE_META[r]);
  const nBins = Math.max(...roles.map((r) => model.roles[r].counts.length));
  const x1 = x0 + nBins * binw;
  const yMax = Math.max(...roles.map((r) => Math.max(...model.roles[r].counts))) || 1;

  // render at the laid-out width, 2x backing store, so nothing is resampled
  const W = Math.max(560, Math.round(canvas.parentElement.clientWidth || 720));
  // AXIS covers tick labels + the x-axis caption; 46px so the caption's
  // descenders aren't clipped by the canvas edge
  const HIST = 200, BAND = 66, AXIS = 46, PAD = { l: 46, r: 12, t: 26 };
  const H = PAD.t + HIST + 10 + roles.length * BAND + AXIS;
  const SC = 2;
  canvas.width = W * SC; canvas.height = H * SC;
  canvas.style.width = W + "px"; canvas.style.aspectRatio = `${W} / ${H}`;
  const ctx = canvas.getContext("2d");
  ctx.scale(SC, SC);

  const plotW = W - PAD.l - PAD.r;
  const sx = (v) => PAD.l + ((v - x0) / (x1 - x0)) * plotW;
  const sy = (c) => PAD.t + HIST - (c / yMax) * HIST;

  // y grid + labels (counts)
  ctx.font = "10px 'IBM Plex Sans', sans-serif"; ctx.fillStyle = INK3;
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  const yStep = Math.pow(10, Math.floor(Math.log10(yMax))) *
    (yMax / Math.pow(10, Math.floor(Math.log10(yMax))) > 5 ? 2 : 1);
  for (let c = 0; c <= yMax; c += yStep) {
    ctx.strokeStyle = LINE; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.l, sy(c)); ctx.lineTo(W - PAD.r, sy(c)); ctx.stroke();
    ctx.fillText(c.toLocaleString(), PAD.l - 6, sy(c));
  }

  // histograms (overlapping, translucent — taker first, keeper on top)
  for (const role of roles) {
    ctx.fillStyle = ROLE_META[role].color;
    ctx.globalAlpha = 0.55;
    model.roles[role].counts.forEach((c, i) => {
      if (!c) return;
      const bx = sx(x0 + i * binw);
      ctx.fillRect(bx, sy(c), sx(x0 + (i + 1) * binw) - bx, PAD.t + HIST - sy(c));
    });
    ctx.globalAlpha = 1;
  }

  // dashed zero line over the full figure height
  const zeroBottom = PAD.t + HIST + 10 + roles.length * BAND;
  ctx.strokeStyle = "#9a958a"; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(sx(0), PAD.t - 6); ctx.lineTo(sx(0), zeroBottom); ctx.stroke();
  ctx.setLineDash([]);

  // per-role band: three label rows on top, boxplot strip + outlier dots below
  roles.forEach((role, i) => {
    const rb = model.roles[role];
    const b = rb.box;
    const bandY = PAD.t + HIST + 10 + i * BAND;
    const cy = bandY + BAND - 14;                       // strip centreline
    const col = ROLE_META[role].color;

    ctx.strokeStyle = INK2; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(sx(b.lo), cy); ctx.lineTo(sx(b.hi), cy); ctx.stroke();
    // outliers beyond the whiskers, as in the blog's boxplots
    ctx.fillStyle = INK3; ctx.globalAlpha = 0.7;
    for (const v of rb.outliers || []) {
      ctx.beginPath(); ctx.arc(sx(v), cy, 1.6, 0, 2 * Math.PI); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = col; ctx.globalAlpha = 0.85;
    ctx.fillRect(sx(b.q1), cy - 7, Math.max(1.5, sx(b.q3) - sx(b.q1)), 14);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(sx(b.med), cy - 7); ctx.lineTo(sx(b.med), cy + 7); ctx.stroke();
    ctx.fillStyle = INK2; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.font = "10px 'IBM Plex Sans', sans-serif";
    ctx.fillText(ROLE_META[role].label, 2, cy);

    // top/bottom-3 labels: coloured dot on the strip + name on one of three
    // rows above it, anchored inward so nothing leaves the canvas; a thin
    // connector drops from the label to its point
    const labelled = [...(rb.low || []).map((e) => ({ ...e, side: "low" })),
                      ...(rb.high || []).map((e) => ({ ...e, side: "high" }))]
      .sort((p, q) => p.med - q.med);
    ctx.font = "9.5px 'IBM Plex Sans', sans-serif";
    labelled.forEach((e, j) => {
      const px = sx(e.med);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(px, cy, 2.6, 0, 2 * Math.PI); ctx.fill();
      const row = j % 3;                                 // 3 stacked label rows
      const ly = bandY + 5 + row * 11;
      ctx.strokeStyle = "#c9c4b8"; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(px, ly + 4); ctx.lineTo(px, cy - 4); ctx.stroke();
      ctx.fillStyle = INK2; ctx.textBaseline = "middle";
      ctx.textAlign = e.side === "low" ? "left" : "right";
      ctx.fillText(`${e.name} (${pp(e.med)})`, e.side === "low" ? px + 3 : px - 3, ly);
    });
  });

  // x axis (pp)
  const axY = zeroBottom + 12;
  ctx.strokeStyle = LINE; ctx.beginPath();
  ctx.moveTo(PAD.l, zeroBottom + 2); ctx.lineTo(W - PAD.r, zeroBottom + 2); ctx.stroke();
  ctx.fillStyle = INK3; ctx.textAlign = "center"; ctx.textBaseline = "top";
  const span = (x1 - x0) * 100;
  const step = span > 24 ? 5 : span > 12 ? 2 : 1;      // pp between ticks
  for (let t = Math.ceil(x0 * 100 / step) * step; t <= x1 * 100; t += step) {
    ctx.fillText(String(t), sx(t / 100), axY - 4);
  }
  ctx.fillStyle = INK2; ctx.font = "11px 'IBM Plex Sans', sans-serif";
  ctx.fillText(xlabel, PAD.l + plotW / 2, axY + 12);

  // legend
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  let lx = PAD.l;
  for (const role of roles) {
    ctx.fillStyle = ROLE_META[role].color; ctx.globalAlpha = 0.75;
    ctx.fillRect(lx, PAD.t - 16, 10, 10); ctx.globalAlpha = 1;
    ctx.fillStyle = INK2; ctx.font = "11px 'IBM Plex Sans', sans-serif";
    const lab = `${ROLE_META[role].label} (${model.roles[role].n.toLocaleString()})`;
    ctx.fillText(lab, lx + 14, PAD.t - 11);
    lx += 14 + ctx.measureText(lab).width + 18;
  }
}

async function init() {
  // data-version note in the navbar
  fetch("/api/site_meta").then((r) => r.json()).then((m) => {
    const latest = [m.tm_latest, m.ws_latest].filter(Boolean).sort().pop();
    if (latest) document.getElementById("phMeta").textContent =
      T("meta.dataThrough", { latest });
  }).catch(() => {});
  const host = document.getElementById("sections");
  let payload;
  try {
    payload = await fetch("/api/models").then((r) => r.json());
  } catch {
    host.innerHTML = `<p class="muted">${T("models.error")}</p>`;
    return;
  }
  const fe = await window.__shim.fixedEffects();
  host.innerHTML = "";
  for (const spec of SECTIONS) {
    const m = payload.models[spec.id];
    if (!m) continue;
    const sec = document.createElement("section");
    let inner = `<h2>${T(spec.title)}</h2><p>${blurbOf(spec, m, fe)}</p>`;
    if (m.roles) inner += `<canvas class="dist-canvas" id="c-${spec.id}"></canvas>` +
      Object.keys(m.roles).map((role) => extremesLine(role, m.roles[role])).join("");
    if (m.summary) inner += `<details class="brms"><summary>${T("models.summaryToggle")}</summary>` +
      `<pre>${esc(m.summary)}</pre></details>`;
    sec.innerHTML = inner;
    host.appendChild(sec);
    if (m.roles) drawDist(document.getElementById(`c-${spec.id}`), m, T(spec.xlabel));
  }
}

init();
