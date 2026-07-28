// Head-to-head comparison page. Two type-aheads pick subjects; /api/compare
// returns P(A better) computed on the model's joint posterior draws plus the
// diff distribution; we draw the per-player skill densities (the same grids
// the dashboards use) and the diff histogram on <canvas>.
"use strict";

// Every sentence on this page comes from copy.js; the dataset wording inside
// it ({filteredLabel}, {modelDataNote}, {archiveSuffix}) is filled from
// config.js, so the private dashboard names its sources and the public site
// keeps them generic.
const role = (keeper, takerKey, keeperKey) => T(keeper ? keeperKey : takerKey);
// per-estimand descriptor keys (page sub-line + PNG caption clause)
const EST_NOTE = { marginal: "compare.estNoteMarginal",
                   in_game: "compare.estNoteIngame",
                   shootout: "compare.estNoteShootout" };

const COL_A = "#C0392B", COL_B = "#3B9AB2", INK = "#16181d", MUTED = "#5a6b73";
const state = { role: "taker", a: null, b: null, estimand: "marginal" };
let MODEL_INFO = null;  // dataset/model figures for the export caption (async)

const $ = (id) => document.getElementById(id);
const pct = (x, d = 0) => (100 * x).toFixed(d) + "%";
const pp = (x, d = 1) => (x >= 0 ? "+" : "") + (100 * x).toFixed(d) + " pp";

// ── type-ahead ────────────────────────────────────────────────────────────────
function wireSearch(which) {
  const input = $(`${which}-input`), sug = $(`${which}-sug`);
  let timer = null;
  input.addEventListener("input", () => {
    state[which] = null;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const q = input.value.trim();
      if (!q) { sug.hidden = true; return; }
      const ep = state.role === "taker" ? "/api/players" : "/api/keepers";
      const rows = await (await fetch(`${ep}?q=${encodeURIComponent(q)}&limit=12`)).json();
      sug.innerHTML = "";
      rows.forEach((r) => {
        const d = document.createElement("div");
        d.innerHTML = `<span>${r.name}${r.hint ? ` <small>${r.hint}</small>` : ""}</span>` +
          `<small>${r.taken ?? r.faced} pens</small>`;
        d.onclick = () => {
          state[which] = { key: r.key, name: r.name };
          input.value = r.name;
          sug.hidden = true;
          run();
        };
        sug.appendChild(d);
      });
      sug.hidden = rows.length === 0;
    }, 180);
  });
  input.addEventListener("blur", () => setTimeout(() => { sug.hidden = true; }, 200));
}

document.querySelectorAll("#role button").forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll("#role button").forEach((x) => x.classList.remove("on"));
    b.classList.add("on");
    state.role = b.dataset.role;
    state.a = state.b = null;
    $("a-input").value = $("b-input").value = "";
    $("out").hidden = true; $("placeholder").hidden = false; $("err").textContent = "";
    $("snap").hidden = true; last = null;
  };
});
// Estimand toggle: which standardization the pp scale uses. P(A better) is the
// same under all three (they are monotone in the same player effect); the
// scale, intervals and baseline are the chosen estimand's. Keeps the picked
// players and just re-runs.
document.querySelectorAll("#estimand button").forEach((b) => {
  b.onclick = () => {
    if (state.estimand === b.dataset.est) return;
    document.querySelectorAll("#estimand button").forEach((x) => x.classList.remove("on"));
    b.classList.add("on");
    state.estimand = b.dataset.est;
    run();
  };
});
wireSearch("a"); wireSearch("b");

// ── fetch + render ────────────────────────────────────────────────────────────
let last = null;  // last payload, so window resizes can redraw crisply

async function run() {
  if (!state.a || !state.b) return;
  $("err").textContent = "";
  const u = `/api/compare?role=${state.role}&a=${encodeURIComponent(state.a.key)}` +
    `&b=${encodeURIComponent(state.b.key)}&estimand=${state.estimand}`;
  const resp = await fetch(u);
  if (!resp.ok) {
    $("out").hidden = true; $("placeholder").hidden = false;
    $("err").textContent = (await resp.json()).detail ||
      T("compare.errorStatus", { status: resp.status });
    return;
  }
  render(await resp.json());
}

window.addEventListener("resize", () => {
  if (last && !$("out").hidden) { drawDensities(last, last.role === "keeper"); drawDiff(last); }
});

function render(d) {
  last = d;
  // unhide BEFORE drawing: a hidden container gives the canvases 0x0 client
  // boxes and everything paints into nothing
  $("placeholder").hidden = true;
  $("out").hidden = false;
  $("snap").hidden = false;
  const keeper = d.role === "keeper";
  const better = role(keeper, "compare.betterTaker", "compare.betterKeeper");
  const [lead, prob] = d.p_a_better >= 0.5 ? [d.a, d.p_a_better] : [d.b, 1 - d.p_a_better];
  const leadCol = lead === d.a ? COL_A : COL_B;
  const bold = (t) => `<b style="color:${leadCol}">${t}</b>`;
  $("verdict").innerHTML = T("compare.verdict", {
    prob: bold(pct(prob, 1)), name: bold(lead.name), better,
  });
  $("verdict-sub").textContent =
    T("compare.verdictSub", { n: d.n_draws.toLocaleString() });

  // display scale: takers = added scoring probability; keepers = added stopping
  // probability, which is the negated effect (CI bounds swap when negating)
  const disp = (s) => keeper
    ? { med: -s.median_added, lo: -s.q975_added, hi: -s.q025_added,
        lo66: -s.q83_added, hi66: -s.q17_added }
    : { med: s.median_added, lo: s.q025_added, hi: s.q975_added,
        lo66: s.q17_added, hi66: s.q83_added };
  const card = (el, s, col) => {
    const v = disp(s);
    el.innerHTML = `<h3>${s.name}</h3>
      <div class="row"><span>${role(keeper, "compare.rowTaken", "compare.rowFaced")}</span><b>${s.pens.toLocaleString()}</b></div>
      <div class="row"><span>${role(keeper, "compare.rowScored", "compare.rowConceded")}</span><b>${s.goals.toLocaleString()} (${s.pens ? pct(s.goals / s.pens) : "–"})</b></div>
      <div class="row"><span>${T("compare.rowSkill")}</span><b style="color:${col}">${pp(v.med)}</b></div>
      <div class="row"><span>${T("compare.rowCi")}</span><b>${pp(v.lo)} … ${pp(v.hi)}</b></div>
      <div class="row"><span>${T("compare.rowRank")}</span><b>${T("compare.rankValue", {
        rank: s.rank.toLocaleString(), n: s.n_ranked.toLocaleString() })}</b></div>`;
  };
  card($("card-a"), d.a, COL_A);
  card($("card-b"), d.b, COL_B);

  $("dens-title").textContent =
    role(keeper, "compare.densTitleTaker", "compare.densTitleKeeper");
  $("dens-sub").textContent = T("compare.densSub", {
    matchup: role(keeper, "compare.matchupTaker", "compare.matchupKeeper"),
  }) + " " + T(EST_NOTE[d.estimand] || EST_NOTE.marginal);
  drawDensities(d, keeper);

  $("diff-title").textContent = T("compare.diffTitle", { a: d.a.name, b: d.b.name });
  drawDiff(d);

  $("note").textContent = T("compare.note");
}

// ── canvas helpers ────────────────────────────────────────────────────────────
function setup(cv) {
  const r = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  cv.width = w * r; cv.height = h * r;
  const ctx = cv.getContext("2d");
  ctx.setTransform(r, 0, 0, r, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return [ctx, w, h];
}

// Both panels share the same horizontal mapping: x in probability units on the
// display scale, xlim = ±half_w (server-computed 99th-percentile rule, same as
// the blog's ggplot) — the players panel is centred on the average player and
// the difference panel on 0, so the dashed guides align vertically.
const PADX = 10;
const mkToX = (w, hw) => (x) => ((x + hw) / (2 * hw)) * (w - 2 * PADX) + PADX;

function axis(ctx, w, h, hw, toX) {
  ctx.strokeStyle = "#e7e8ec"; ctx.beginPath();
  ctx.moveTo(0, h - 22); ctx.lineTo(w, h - 22); ctx.stroke();
  ctx.fillStyle = MUTED; ctx.font = "11px IBM Plex Sans, sans-serif"; ctx.textAlign = "center";
  const step = niceStep(2 * hw);
  for (let t = Math.ceil(-hw / step) * step; t <= hw + 1e-12; t += step) {
    const tv = Math.abs(t) < step * 1e-6 ? 0 : t;  // no "-0 pp" from fp noise
    ctx.fillText(pp(tv, Math.abs(step) >= 0.01 ? 0 : 1), toX(tv), h - 8);
  }
  ctx.textAlign = "left";
}
const niceStep = (span) => {
  const raw = span / 6, mag = 10 ** Math.floor(Math.log10(raw)), r = raw / mag;
  return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * mag;
};

// ggdist-style half-eye: density slab above a baseline, 95% (thin) and 66%
// (thick) credible-interval bars on the baseline, median dot.
function halfEye(ctx, toX, baseY, slabH, pts, ymax, fill, iv) {
  ctx.beginPath();
  ctx.moveTo(toX(pts[0][0]), baseY);
  for (const [x, y] of pts) ctx.lineTo(toX(x), baseY - (y / ymax) * slabH);
  ctx.lineTo(toX(pts[pts.length - 1][0]), baseY);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.stroke();
  if (!iv) return;
  ctx.strokeStyle = INK; ctx.lineCap = "round";
  ctx.lineWidth = 2; ctx.beginPath();
  ctx.moveTo(toX(iv.lo), baseY); ctx.lineTo(toX(iv.hi), baseY); ctx.stroke();
  ctx.lineWidth = 4.5; ctx.beginPath();
  ctx.moveTo(toX(iv.lo66), baseY); ctx.lineTo(toX(iv.hi66), baseY); ctx.stroke();
  ctx.lineCap = "butt";
  ctx.fillStyle = INK; ctx.beginPath();
  ctx.arc(toX(iv.med), baseY, 3.4, 0, 2 * Math.PI); ctx.fill();
}

// clip a player's shared-grid density to the panel xlim, on the display scale
function slabPts(dens, keeper, hw) {
  const n = dens.n ?? dens.y.length;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const raw = dens.x_min + (i / (n - 1)) * (dens.x_max - dens.x_min);
    const x = keeper ? -raw : raw;
    if (x >= -hw && x <= hw) pts.push([x, dens.y[i]]);
  }
  if (keeper) pts.reverse();  // keep x ascending when mirrored
  return pts;
}

function drawDensities(d, keeper, target) {
  const [ctx, w, h] = target || setup($("dens"));
  const hw = d.half_w, toX = mkToX(w, hw);
  const disp = (s) => keeper
    ? { med: -s.median_added, lo: -s.q975_added, hi: -s.q025_added,
        lo66: -s.q83_added, hi66: -s.q17_added }
    : { med: s.median_added, lo: s.q025_added, hi: s.q975_added,
        lo66: s.q17_added, hi66: s.q83_added };
  // absolute anchor: the average player's rate on this role's display scale
  const base = keeper ? 1 - d.a.base_prob : d.a.base_prob;
  const axisY = h - 22, topPad = 18;
  const rowH = (axisY - 6 - topPad) / 2;
  const ptsA = slabPts(d.a.dens, keeper, hw), ptsB = slabPts(d.b.dens, keeper, hw);
  const ymax = Math.max(...ptsA.map((p) => p[1]), ...ptsB.map((p) => p[1])) * 1.04;

  // dashed average-player line first, so both slabs paint over it
  ctx.strokeStyle = MUTED; ctx.setLineDash([4, 4]); ctx.beginPath();
  ctx.moveTo(toX(0), topPad - 4); ctx.lineTo(toX(0), axisY); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = MUTED; ctx.font = "11px IBM Plex Sans, sans-serif";
  // Name both sides of the matchup: this baseline is the intercept — an average
  // keeper facing an average taker — not the raw league average (they differ
  // because averaging on the logit scale isn't the same as averaging rates).
  const avgTxt = T(keeper ? "compare.avgLineKeeper" : "compare.avgLineTaker",
    { p: pct(base, 1) });
  const rightRoom = w - toX(0) > ctx.measureText(avgTxt).width + 12;
  ctx.textAlign = rightRoom ? "left" : "right";
  ctx.fillText(avgTxt, toX(0) + (rightRoom ? 6 : -6), topPad + 4);
  ctx.textAlign = "left";

  [[d.a, COL_A, 1], [d.b, COL_B, 2]].forEach(([s, col, row]) => {
    const v = disp(s), baseY = topPad + row * rowH, pts = row === 1 ? ptsA : ptsB;
    halfEye(ctx, toX, baseY, rowH - 16, pts, ymax, col + "b3", v);
    const labelY = baseY - rowH + 24;
    ctx.font = "600 12px IBM Plex Sans, sans-serif"; ctx.fillStyle = col;
    ctx.fillText(s.name, PADX, labelY);
    const nameW = ctx.measureText(s.name).width;
    ctx.font = "11px IBM Plex Sans, sans-serif"; ctx.fillStyle = MUTED;
    ctx.fillText(`${keeper ? "stops" : "scores"} ${pct(base + v.med, 1)} (${pp(v.med)})`,
      PADX + nameW + 10, labelY);
  });
  axis(ctx, w, h, hw, toX);
}

function drawDiff(d, target) {
  const [ctx, w, h] = target || setup($("diffc"));
  const hw = d.half_w, toX = mkToX(w, hw);
  const dens = d.diff.dens, n = dens.y.length;
  const axisY = h - 26, topPad = 18;
  const ymax = Math.max(...dens.y) * 1.04;
  const gx = (i) => dens.x_min + (i / (n - 1)) * (dens.x_max - dens.x_min);
  // the slab, fill split at zero: right of 0 = A better (A's colour)
  const side = (lo, hi, col) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(toX(lo), 0, toX(hi) - toX(lo), h);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(toX(gx(0)), axisY);
    for (let i = 0; i < n; i++) ctx.lineTo(toX(gx(i)), axisY - (dens.y[i] / ymax) * (axisY - topPad));
    ctx.lineTo(toX(gx(n - 1)), axisY);
    ctx.closePath();
    ctx.fillStyle = col + "b3"; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  };
  side(-hw, 0, COL_B); side(0, hw, COL_A);

  // dashed zero line + who-is-better side labels
  ctx.strokeStyle = MUTED; ctx.setLineDash([4, 4]); ctx.beginPath();
  ctx.moveTo(toX(0), topPad - 4); ctx.lineTo(toX(0), axisY); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = "600 11px IBM Plex Sans, sans-serif";
  ctx.fillStyle = COL_A; ctx.textAlign = "left";
  ctx.fillText(`${d.a.name} better →`, toX(0) + 8, topPad + 2);
  ctx.fillStyle = COL_B; ctx.textAlign = "right";
  ctx.fillText(`← ${d.b.name} better`, toX(0) - 8, topPad + 2);
  ctx.textAlign = "left";

  // median + 66%/95% CrI on the baseline, same grammar as the players panel
  halfEye(ctx, toX, axisY, 0, [[0, 0], [0, 0]], 1, "transparent", {
    lo: d.diff.q025, hi: d.diff.q975, lo66: d.diff.q17, hi66: d.diff.q83, med: d.diff.median,
  });
  axis(ctx, w, h, hw, toX);
}

// ── PNG export: verdict + cards + both charts on one canvas ──────────────────
const SANS = '"IBM Plex Sans", sans-serif';
const DISPLAY = '"Atkinson Hyperlegible", "Trebuchet MS", sans-serif';
const slug = (s) => String(s).replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-|-$/g, "");

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

// Full model/dataset blurb for the export footer — matches the blog figure's
// caption (compare_skills_gks_new.R) so the shared image reads the same.
function modelCaption(keeper, estimand) {
  const m = MODEL_INFO;
  const thru = (d) => (d ? T("caption.through", { date: d }) : "");
  let s = T("caption.skill", {
    skill: T(keeper ? "card.skillKeeper" : "card.skillTaker"),
    estimand: T(keeper ? "caption.estimandKeeper" : "caption.estimandTaker"),
  });
  if (estimand && estimand !== "marginal")
    s += " " + T(EST_NOTE[estimand]);
  if (m && m.n_pen != null) {
    s += " " + T("caption.fit", {
      n: m.n_pen.toLocaleString(), through: thru(m.tm_latest) });
    s += (m.n_taker && m.n_gk)
      ? T("caption.covering", {
          takers: m.n_taker.toLocaleString(), keepers: m.n_gk.toLocaleString() })
      : ".";
  }
  return s + " " + T("caption.pp") + " " + T("caption.more");
}

function exportPng(d) {
  const SC = 2, W = 880, padX = 26, colW = (W - 2 * padX - 20) / 2;
  const keeper = d.role === "keeper";
  const chartW = W - 2 * padX, chartH = 230;
  const lineH = 14;

  const meas = document.createElement("canvas").getContext("2d");
  meas.font = `11px ${SANS}`;
  const noteLines = wrapText(meas, modelCaption(keeper, d.estimand), chartW);

  const cardTop = 110, cardH = 112;
  const densTop = cardTop + cardH + 14;
  const diffTop = densTop + 26 + chartH + 18;
  const footTop = diffTop + 26 + chartH + 16;
  const H = footTop + 10 + noteLines.length * lineH + 12;

  const out = document.createElement("canvas");
  out.width = W * SC; out.height = Math.round(H * SC);
  const ctx = out.getContext("2d");
  ctx.scale(SC, SC);
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";

  // title
  ctx.fillStyle = INK; ctx.font = `700 24px ${DISPLAY}`;
  ctx.fillText(`${d.a.name} vs ${d.b.name}`, padX, 36);
  ctx.fillStyle = MUTED; ctx.font = `12.5px ${SANS}`;
  ctx.fillText(T("compare.pngSubtitle", {
    role: role(keeper, "compare.pngRoleTakers", "compare.pngRoleKeepers"),
    n: d.n_draws.toLocaleString(),
  }), padX, 56);

  // The verdict, drawn from the SAME copy string the page uses: split the
  // template on its {placeholders} so the two filled-in values keep the
  // leader's colour and weight while the prose around them stays one sentence.
  const better = role(keeper, "compare.betterTaker", "compare.betterKeeper");
  const [lead, prob] = d.p_a_better >= 0.5 ? [d.a, d.p_a_better] : [d.b, 1 - d.p_a_better];
  const leadCol = lead === d.a ? COL_A : COL_B;
  let x = padX;
  const seg = (t, col, font) => {
    ctx.font = font; ctx.fillStyle = col;
    ctx.fillText(t, x, 88); x += ctx.measureText(t).width;
  };
  const strong = { prob: pct(prob, 1), name: lead.name };
  for (const tok of T.raw("compare.verdict").split(/(\{\w+\})/)) {
    const key = tok.startsWith("{") && tok.slice(1, -1);
    if (key && key in strong) seg(strong[key], leadCol, `700 16px ${SANS}`);
    else seg(key === "better" ? better : tok, INK, `15px ${SANS}`);
  }

  // the two player cards as text columns
  const disp = (s) => keeper
    ? { med: -s.median_added, lo: -s.q975_added, hi: -s.q025_added }
    : { med: s.median_added, lo: s.q025_added, hi: s.q975_added };
  [[d.a, COL_A, padX], [d.b, COL_B, padX + colW + 20]].forEach(([s, col, cx]) => {
    const v = disp(s);
    ctx.fillStyle = col; ctx.font = `700 15px ${DISPLAY}`;
    ctx.fillText(s.name, cx, cardTop + 14);
    ctx.font = `12px ${SANS}`;
    const rows = [
      [role(keeper, "compare.rowTaken", "compare.rowFaced"), s.pens.toLocaleString()],
      [role(keeper, "compare.rowScored", "compare.rowConceded"),
       `${s.goals.toLocaleString()} (${s.pens ? pct(s.goals / s.pens) : "–"})`],
      [T("compare.rowSkill"), pp(v.med)],
      [T("compare.rowCi"), `${pp(v.lo)} … ${pp(v.hi)}`],
      [T("compare.rowRank"), T("compare.rankValue", {
        rank: s.rank.toLocaleString(), n: s.n_ranked.toLocaleString() })],
    ];
    rows.forEach(([k, val], i) => {
      const ry = cardTop + 34 + i * 16;
      ctx.fillStyle = MUTED; ctx.textAlign = "left"; ctx.fillText(k, cx, ry);
      ctx.fillStyle = INK; ctx.textAlign = "right"; ctx.fillText(val, cx + colW, ry);
    });
    ctx.textAlign = "left";
  });

  // charts re-rendered offscreen at 2x, with their on-page titles
  const off = (w, h) => {
    const cv = document.createElement("canvas");
    cv.width = w * SC; cv.height = h * SC;
    const c = cv.getContext("2d");
    c.setTransform(SC, 0, 0, SC, 0, 0);
    return [cv, [c, w, h]];
  };
  const chart = (title, top, drawFn) => {
    ctx.fillStyle = INK; ctx.font = `600 13px ${SANS}`;
    ctx.fillText(title, padX, top + 14);
    const [cv, t] = off(chartW, chartH);
    drawFn(t);
    ctx.drawImage(cv, padX, top + 22, chartW, chartH);
  };
  chart($("dens-title").textContent, densTop, (t) => drawDensities(d, keeper, t));
  chart(T("compare.diffTitle", { a: d.a.name, b: d.b.name }), diffTop, (t) => drawDiff(d, t));

  // footer note
  ctx.strokeStyle = "#e7e8ec"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padX, footTop + 0.5); ctx.lineTo(W - padX, footTop + 0.5); ctx.stroke();
  ctx.fillStyle = MUTED; ctx.font = `11px ${SANS}`;
  noteLines.forEach((ln, i) => ctx.fillText(ln, padX, footTop + 16 + i * lineH));

  const a = document.createElement("a");
  a.href = out.toDataURL("image/png");
  a.download = `compare-${slug(d.a.name)}-vs-${slug(d.b.name)}.png`;
  a.click();
}
$("snap").onclick = () => { if (last) exportPng(last); };

// dataset/model figures for the export caption; fetch-and-forget (loaded well
// before anyone picks two players and hits export)
fetch("/api/model_info").then((r) => r.json()).then((m) => { MODEL_INFO = m; }).catch(() => {});

// deep link: /compare?role=keeper&a=tm565093&b=tm646991&estimand=shootout
(function initFromUrl() {
  const p = new URLSearchParams(location.search);
  const a = p.get("a"), b = p.get("b");
  if (p.get("role") === "keeper") document.querySelector('#role button[data-role="keeper"]').click();
  const est = p.get("estimand");
  if (est && EST_NOTE[est]) {
    state.estimand = est;
    document.querySelectorAll("#estimand button").forEach((x) =>
      x.classList.toggle("on", x.dataset.est === est));
  }
  if (!a || !b) return;
  state.a = { key: a, name: "" };
  state.b = { key: b, name: "" };
  run().then(() => {
    if (last) { $("a-input").value = last.a.name; $("b-input").value = last.b.name; }
  });
})();
