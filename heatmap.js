// Standalone post-shot goal-probability surface (the psxg_grid model output).
// The canvas rendering here is lifted from the private dashboard's shot map —
// same heat bitmap, goal frame, axes, colourbar, cursor ball and CI tooltip —
// minus the per-player shots, which the public site doesn't carry.
"use strict";

// ---- goal geometry (metres) ------------------------------------------------
const POST = 3.66, CROSSBAR = 2.44, PR = 0.12 / 2, DIVE = 0.83;
const BALL_R = (0.69 / Math.PI) / 2;
const X_RANGE = [-4.7, 4.7];
const Y_RANGE = [-0.4, 4.6];
const PAD = { l: 34, r: 76, t: 12, b: 34 };       // axis gutter + colourbar

const INK = "#16181d", INK2 = "#5c616b", INK3 = "#989ea9", LINE = "#d9dbe1";
const FONT_SANS = '"IBM Plex Sans", sans-serif';
const FONT_DISPLAY = '"Atkinson Hyperlegible", "Trebuchet MS", sans-serif';

// reversed Zissou1 -> red = low goal probability, blue = high
const COLORSCALE = [
  [0.0, "#F21A00"], [0.25, "#E1AF00"], [0.5, "#EBCC2A"],
  [0.75, "#78B7C5"], [1.0, "#3B9AB2"],
];
const clamp = (v, [lo, hi]) => Math.min(Math.max(v, lo), hi);
const CSTOPS = COLORSCALE.map(([t, hex]) => ({ t, c: [
  parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)] }));
function ramp(u) {
  u = clamp(u, [0, 1]);
  let i = 1;
  while (i < CSTOPS.length - 1 && u > CSTOPS[i].t) i++;
  const a = CSTOPS[i - 1], b = CSTOPS[i];
  const f = b.t === a.t ? 0 : (u - a.t) / (b.t - a.t);
  return [0, 1, 2].map((k) => Math.round(a.c[k] + (b.c[k] - a.c[k]) * f));
}
const rgb = (a) => `rgb(${a[0]},${a[1]},${a[2]})`;

// ---- state -------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
let GRID = null, MODEL_INFO = null, currentFoot = "Right";
let COLORBAR_TICKS = [];
let TX = null;                 // current world<->pixel transform
let mouse = null;
const heatCache = {};          // foot -> offscreen probability bitmap

function computeLayout() {
  const c = $("goalCanvas"), stage = c.parentElement;
  const availW = stage.clientWidth - 16, availH = stage.clientHeight - 16;
  const xspan = X_RANGE[1] - X_RANGE[0], yspan = Y_RANGE[1] - Y_RANGE[0];
  let cssW = availW, s = (cssW - PAD.l - PAD.r) / xspan, cssH = s * yspan + PAD.t + PAD.b;
  if (cssH > availH) { cssH = availH; s = (cssH - PAD.t - PAD.b) / yspan; cssW = s * xspan + PAD.l + PAD.r; }
  const dpr = window.devicePixelRatio || 1;
  c.style.width = cssW + "px"; c.style.height = cssH + "px";
  c.style.left = Math.max(6, (stage.clientWidth - cssW) / 2) + "px";
  c.width = Math.round(cssW * dpr); c.height = Math.round(cssH * dpr);
  TX = { dpr, cssW, cssH, s, ox: PAD.l - X_RANGE[0] * s, oy: PAD.t + Y_RANGE[1] * s };
}

// Smooth probability field for a foot, rendered once at grid resolution into an
// offscreen canvas; drawImage upscales it with bilinear smoothing.
function heatBitmap(foot) {
  if (heatCache[foot]) return heatCache[foot];
  const g = GRID[foot.toLowerCase()], nx = GRID.x.length, ny = GRID.y.length;
  const off = document.createElement("canvas");
  off.width = nx; off.height = ny;
  const ic = off.getContext("2d"), img = ic.createImageData(nx, ny);
  const span = GRID.zmax - GRID.zmin || 1;
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) {
    const prob = g.prob[r][c];
    const p = ((ny - 1 - r) * nx + c) * 4;          // flip: grid row 0 = bottom
    if (prob == null) { img.data[p + 3] = 0; continue; }
    const col = ramp((prob - GRID.zmin) / span);
    img.data[p] = col[0]; img.data[p + 1] = col[1]; img.data[p + 2] = col[2]; img.data[p + 3] = 255;
  }
  ic.putImageData(img, 0, 0);
  return (heatCache[foot] = off);
}

function drawChart(ctx, tx, opts) {
  const wx = (x) => tx.ox + x * tx.s, wy = (y) => tx.oy - y * tx.s;
  ctx.save();
  ctx.scale(tx.dpr, tx.dpr);
  ctx.clearRect(0, 0, tx.cssW, tx.cssH);
  const bmp = heatBitmap(opts.foot);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, wx(GRID.x[0]), wy(GRID.y[GRID.y.length - 1]),
    (GRID.x[GRID.x.length - 1] - GRID.x[0]) * tx.s, (GRID.y[GRID.y.length - 1] - GRID.y[0]) * tx.s);
  drawAxes(ctx, tx, wx, wy);
  drawFrame(ctx, tx, wx, wy);
  if (opts.cursor) drawCursorBall(ctx, tx, opts.cursor);
  drawColorbar(ctx, tx);
  ctx.restore();
}

function drawFrame(ctx, tx, wx, wy) {
  ctx.fillStyle = INK;
  const rect = (x0, x1, y0, y1) => ctx.fillRect(wx(x0), wy(y1), (x1 - x0) * tx.s, (y1 - y0) * tx.s);
  rect(-POST - PR, -POST + PR, 0, CROSSBAR + PR);   // left post
  rect(POST - PR, POST + PR, 0, CROSSBAR + PR);     // right post
  rect(-POST - PR, POST + PR, CROSSBAR - PR, CROSSBAR + PR);   // crossbar
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath();   // goal line
  ctx.moveTo(wx(-(POST + 0.45)), wy(0)); ctx.lineTo(wx(POST + 0.45), wy(0)); ctx.stroke();
  ctx.strokeStyle = "rgba(22,24,29,.28)"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
  for (const x of [-DIVE, DIVE]) {                  // dive zones
    ctx.beginPath(); ctx.moveTo(wx(x), wy(0)); ctx.lineTo(wx(x), wy(CROSSBAR)); ctx.stroke();
  }
  ctx.setLineDash([]);
}

// Translucent, to-scale ball that follows the cursor.
function drawCursorBall(ctx, tx, m) {
  const r = Math.max(3.5, BALL_R * tx.s);
  ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, 2 * Math.PI);
  ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.fill();
  ctx.lineWidth = 1.2; ctx.strokeStyle = "rgba(22,24,29,.55)"; ctx.stroke();
}

function drawAxes(ctx, tx, wx, wy) {
  ctx.fillStyle = INK3; ctx.strokeStyle = LINE; ctx.lineWidth = 1;
  ctx.font = `10px ${FONT_SANS}`; ctx.textAlign = "center"; ctx.textBaseline = "top";
  for (let x = -4; x <= 4; x++) {
    ctx.beginPath(); ctx.moveTo(wx(x), wy(Y_RANGE[0])); ctx.lineTo(wx(x), wy(Y_RANGE[0]) + 3); ctx.stroke();
    ctx.fillText(String(x), wx(x), wy(Y_RANGE[0]) + 5);
  }
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (let y = 0; y <= 4; y++) {
    ctx.beginPath(); ctx.moveTo(wx(X_RANGE[0]), wy(y)); ctx.lineTo(wx(X_RANGE[0]) - 3, wy(y)); ctx.stroke();
    ctx.fillText(String(y), wx(X_RANGE[0]) - 6, wy(y));
  }
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillText(T("heatmap.axisWidth"), (wx(X_RANGE[0]) + wx(X_RANGE[1])) / 2, tx.cssH - 4);
  ctx.save();
  ctx.translate(11, (wy(Y_RANGE[0]) + PAD.t) / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText(T("heatmap.axisHeight"), 0, 0); ctx.restore();
}

function drawColorbar(ctx, tx) {
  const x = tx.cssW - PAD.r + 24, w = 11;
  const top = PAD.t + 26, h = (tx.cssH - PAD.t - PAD.b) * 0.62;
  const grad = ctx.createLinearGradient(0, top, 0, top + h);
  for (let i = 0; i <= 10; i++) grad.addColorStop(i / 10, rgb(ramp(1 - i / 10)));
  ctx.fillStyle = grad; ctx.fillRect(x, top, w, h);
  ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.strokeRect(x, top, w, h);
  ctx.fillStyle = INK2; ctx.font = `10px ${FONT_SANS}`;
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  const span = GRID.zmax - GRID.zmin || 1;
  for (const v of COLORBAR_TICKS) {
    const ty = top + h * (1 - (v - GRID.zmin) / span);
    ctx.strokeStyle = LINE; ctx.beginPath(); ctx.moveTo(x + w, ty); ctx.lineTo(x + w + 3, ty); ctx.stroke();
    ctx.fillText(Math.round(v * 100) + "%", x + w + 6, ty);
  }
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillText(T("heatmap.colorbar"), x + w / 2, top - 8);
}

function render() {
  if (!TX || !GRID) return;
  drawChart($("goalCanvas").getContext("2d"), TX, { foot: currentFoot, cursor: mouse });
}
function drawPlot() {
  if (!GRID) return;
  computeLayout();
  render();
}

// ---- tooltip: goal probability + credible interval at the cursor ------------
function gridProbAt(px, py) {
  const wxv = (px - TX.ox) / TX.s, wyv = (TX.oy - py) / TX.s;
  if (wxv < GRID.x[0] || wxv > GRID.x[GRID.x.length - 1]) return null;
  if (wyv < GRID.y[0] || wyv > GRID.y[GRID.y.length - 1]) return null;
  const near = (arr, v) => arr.reduce((bi, _, i) => Math.abs(arr[i] - v) < Math.abs(arr[bi] - v) ? i : bi, 0);
  const g = GRID[currentFoot.toLowerCase()], r = near(GRID.y, wyv), c = near(GRID.x, wxv);
  return g.prob[r][c] == null ? null : { p: g.prob[r][c], lo: g.lo[r][c], hi: g.hi[r][c] };
}

function onMove(e) {
  const rect = $("goalCanvas").getBoundingClientRect();
  mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  const tip = $("chartTip");
  const g = gridProbAt(mouse.x, mouse.y);
  if (g) {
    const pct = (v) => (v * 100).toFixed(0) + "%";
    tip.innerHTML = T("heatmap.tip", { p: pct(g.p) }) +
      `<span class="tip-hint">${T("heatmap.tipCi", {
        lo: (g.lo * 100).toFixed(0), hi: pct(g.hi),
      })}</span>`;
    tip.classList.remove("hidden");
    const stage = $("goalCanvas").parentElement.getBoundingClientRect();
    let x = e.clientX - stage.left + 16, y = e.clientY - stage.top + 16;
    x = Math.min(x, stage.width - tip.offsetWidth - 8);
    y = Math.min(y, stage.height - tip.offsetHeight - 8);
    tip.style.left = Math.max(8, x) + "px"; tip.style.top = Math.max(8, y) + "px";
  } else {
    tip.classList.add("hidden");
  }
  requestAnimationFrame(render);
}

// ---- PNG export ---------------------------------------------------------------
function wrapText(ctx, text, maxW) {
  const words = text.split(" "), lines = [];
  let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (line && ctx.measureText(t).width > maxW) { lines.push(line); line = w; }
    else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

function exportPng() {
  if (!TX || !GRID) return;
  const SC = 2, P = (v) => v * SC;
  const cw = Math.round(TX.cssW * SC), chartH = Math.round(TX.cssH * SC);
  const m = MODEL_INFO;
  let cap = T("heatmap.pngCapIntro", { foot: currentFoot.toLowerCase() });
  if (m && m.n_psxg_pen != null)
    cap += " " + T("heatmap.pngCapFit", { n: m.n_psxg_pen.toLocaleString() });
  cap += ". " + T("heatmap.pngCapZones");
  cap += " " + T("caption.more");
  const meas = document.createElement("canvas").getContext("2d");
  meas.font = `${P(11)}px ${FONT_SANS}`;
  const lines = wrapText(meas, cap, cw - P(52));
  const headH = P(56), footH = P(14) + lines.length * P(15);

  const off = document.createElement("canvas");
  off.width = cw; off.height = headH + chartH + footH;
  const ctx = off.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, off.width, off.height);
  ctx.fillStyle = INK; ctx.font = `700 ${P(22)}px ${FONT_DISPLAY}`;
  ctx.fillText(T("heatmap.pngTitle"), P(26), P(34));
  ctx.fillStyle = INK2; ctx.font = `${P(12)}px ${FONT_SANS}`;
  ctx.fillText(T("heatmap.pngSubtitle", { foot: currentFoot }), P(26), P(50));
  const cnv = document.createElement("canvas");
  cnv.width = cw; cnv.height = chartH;
  drawChart(cnv.getContext("2d"), { ...TX, dpr: SC }, { foot: currentFoot, cursor: null });
  ctx.drawImage(cnv, 0, headH);
  ctx.strokeStyle = LINE; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(P(26), headH + chartH + P(1)); ctx.lineTo(cw - P(26), headH + chartH + P(1)); ctx.stroke();
  ctx.fillStyle = INK3; ctx.font = `${P(11)}px ${FONT_SANS}`;
  lines.forEach((ln, i) => ctx.fillText(ln, P(26), headH + chartH + P(15) + i * P(15)));

  const a = document.createElement("a");
  a.href = off.toDataURL("image/png");
  a.download = `goal-probability-${currentFoot.toLowerCase()}.png`;
  a.click();
}

// ---- wiring ---------------------------------------------------------------
$("footToggle").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  currentFoot = b.dataset.foot;
  $("footToggle").querySelectorAll("button").forEach((x) =>
    x.classList.toggle("active", x.dataset.foot === currentFoot));
  render();
});
$("exportPng").addEventListener("click", exportPng);
window.addEventListener("resize", drawPlot);
const cv = $("goalCanvas");
cv.addEventListener("mousemove", onMove);
cv.addEventListener("mouseleave", () => {
  mouse = null; $("chartTip").classList.add("hidden"); requestAnimationFrame(render);
});

(async () => {
  GRID = await fetch("/api/xg_grid").then((r) => r.json());
  const interior = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0].filter((v) => v > GRID.zmin + 0.05);
  COLORBAR_TICKS = [GRID.zmin, ...interior];
  drawPlot();
})();
fetch("/api/model_info").then((r) => r.json()).then((m) => {
  MODEL_INFO = m;
  if (m.n_psxg_pen != null)
    $("subline").textContent =
      T("heatmap.sublineFitted", { n: m.n_psxg_pen.toLocaleString() });
}).catch(() => {});
