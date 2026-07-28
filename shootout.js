// Penalty shootout simulator. Two rosters + keepers are picked with the same
// type-aheads as /compare; /api/shootout_data returns, per taker, 1000 joint
// posterior draws of P(goal) ALREADY conditioned on the opposing keeper
// (p[i] = plogis(b0[i] + r_taker[i] + r_keeper[i]) — the crossed model is
// additive on the logit scale, so no server-side predict is needed). The Monte
// Carlo runs here in the browser: for each posterior draw we simulate many
// shootouts, so parameter uncertainty and shootout luck both propagate, and
// reordering takers or tweaking the no-record baseline re-simulates instantly
// without another fetch.
"use strict";

const COL_H = "#C0392B", COL_A = "#3B9AB2", INK = "#16181d", MUTED = "#5a6b73", LINE = "#e7e8ec";
const SK_UP = "#188038", SK_DOWN = "#c2402c";  // skill vs the modelled average
const SIMS_PER_DRAW = 500;   // x 1000 draws = 500k shootouts, well under a second
const MAX_TAKERS = 11;

const state = {
  home: { gk: null, takers: [], manual: false, label: null },  // takers: [{key, name}]
  away: { gk: null, takers: [], manual: false, label: null },
  base: 0.72,  // P(score) vs average keeper for takers the model never saw
  first: "coin",  // who kicks first: "home" | "away" | "coin" (50/50 per shootout)
  fun: false,  // fun mode: the same taker may appear multiple times in a roster
};
let data = null;        // last /api/shootout_data payload
let fetchedSig = null;  // roster signature the payload corresponds to
let sim = null;         // last simulation summary (for resize redraws)

const $ = (id) => document.getElementById(id);
const pct = (x, d = 1) => (100 * x).toFixed(d) + "%";
const plogis = (x) => 1 / (1 + Math.exp(-x));
const qlogis = (p) => Math.log(p / (1 - p));
const TEAM = { home: "Team A", away: "Team B" };
const COL = { home: COL_H, away: COL_A };
// display name: the filled-from team if one was picked, else Team A/B
const tlabel = (s) => state[s].label || TEAM[s];

// ── type-aheads (same pattern as compare.js) ─────────────────────────────────
function wireSearch(side, kind) {
  const input = $(`${side}-${kind}-input`), sug = $(`${side}-${kind}-sug`);
  let timer = null;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const q = input.value.trim();
      if (!q) { sug.hidden = true; return; }
      const ep = kind === "gk" ? "/api/keepers" : "/api/players";
      const rows = await (await fetch(`${ep}?q=${encodeURIComponent(q)}&limit=12`)).json();
      sug.innerHTML = "";
      rows.forEach((r) => {
        const d = document.createElement("div");
        d.innerHTML = `<span>${r.name}${r.hint ? ` <small>${r.hint}</small>` : ""}</span>` +
          `<small>${r.taken ?? r.faced} pens</small>`;
        d.onclick = () => {
          if (kind === "gk") {
            state[side].gk = { key: r.key, name: r.name };
            input.value = "";
          } else {
            const t = state[side].takers;
            if (t.length < MAX_TAKERS && (state.fun || !t.some((x) => x.key === r.key))) {
              t.push({ key: r.key, name: r.name });
            }
            input.value = "";
          }
          sug.hidden = true;
          update();
        };
        sug.appendChild(d);
      });
      sug.hidden = rows.length === 0;
    }, 180);
  });
  input.addEventListener("blur", () => setTimeout(() => { sug.hidden = true; }, 200));
}
["home", "away"].forEach((s) => { wireSearch(s, "gk"); wireSearch(s, "tk"); });

// "Fill from team": pick a club or national team, get its best 5 takers and
// its #1 keeper as a starting roster (all still editable afterwards).
function wireTeamSearch(side) {
  const input = $(`${side}-team-input`), sug = $(`${side}-team-sug`);
  let timer = null;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const q = input.value.trim();
      if (!q) { sug.hidden = true; return; }
      const rows = await (await fetch(`/api/teams?q=${encodeURIComponent(q)}&limit=12`)).json();
      sug.innerHTML = "";
      rows.forEach((r) => {
        const d = document.createElement("div");
        d.innerHTML = `<span>${esc(r.name)}</span><small>${esc(r.hint)}</small>`;
        d.onclick = async () => {
          sug.hidden = true;
          input.value = "";
          const resp = await fetch(
            `/api/team_roster?type=${r.type}&id=${encodeURIComponent(r.id)}`);
          if (!resp.ok) {
            $("err").textContent = (await resp.json()).detail ||
              T("shootout.errorStatus", { status: resp.status });
            return;
          }
          const t = await resp.json();
          if (!t.takers.length) {
            $("err").textContent = T("shootout.noTakers", { team: t.name });
            return;
          }
          state[side].takers = t.takers;  // full lineup, up to 11
          state[side].gk = t.keeper;
          state[side].label = t.name;
          state[side].manual = false;
          update();
        };
        sug.appendChild(d);
      });
      sug.hidden = rows.length === 0;
    }, 180);
  });
  input.addEventListener("blur", () => setTimeout(() => { sug.hidden = true; }, 200));
}
["home", "away"].forEach(wireTeamSearch);

// ── roster rendering ─────────────────────────────────────────────────────────
const esc = (s) => String(s ?? "").replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function payloadTaker(side, key) {
  const sd = data && data[side];
  return sd ? sd.takers.find((t) => t.key === key) : null;
}

// Coloured ▲/▼ badge comparing a skill-level mean with the model's average
// (base_prob = average taker vs average keeper). Both numbers are P(goal), so
// for keepers LOWER is better and the arrow flips.
function skillSpan(p, role) {
  if (!data || data.base_prob == null || p == null) return "";
  const avg = data.base_prob;
  const up = role === "keeper" ? p < avg : p > avg;
  const title = T(role === "keeper"
    ? "shootout.skillTitleKeeper" : "shootout.skillTitleTaker",
    { p: pct(p), avg: pct(avg) });
  return `<span class="sk ${up ? "up" : "down"}" title="${title}">${up ? "▲" : "▼"}${pct(p)}</span>`;
}

function renderTeam(side) {
  const st = state[side];
  $(`${side}-label`).textContent = st.label || "";
  const chip = $(`${side}-gk-chip`);
  if (st.gk) {
    // only trust payload keeper info if it is actually about the selected gk
    // (a fetch may still be in flight right after a change)
    const pk0 = data && data[side] && data[side].keeper;
    const pk = pk0 && pk0.key === st.gk.key ? pk0 : null;
    const flag = pk && pk.no_skill
      ? `<span class="flag" title="${T("shootout.gkNoRecord")}">${T("shootout.noRecord")}</span>` : "";
    const sk = pk && !pk.no_skill ? skillSpan(pk.p_avg_taker, "keeper") : "";
    chip.innerHTML = `<div class="gk-chip">🧤 <span class="nm">${esc(st.gk.name)}</span>${sk}${flag}` +
      `<button title="${T("shootout.gkRemove")}" data-act="gk-x">✕</button></div>`;
    chip.querySelector("button").onclick = () => { st.gk = null; update(); };
  } else {
    chip.innerHTML = `<div class="gk-chip" style="color:#8a949b">${T("shootout.gkAverage")}</div>`;
  }

  const list = $(`${side}-tk-list`);
  list.innerHTML = "";
  // laws of the game: the bigger squad is reduced to the smaller one's size
  const nEff = Math.min(state.home.takers.length, state.away.takers.length);
  // show "vs GK" (next to the skill badge) only when the opposing keeper is
  // modelled — otherwise the two numbers are the same
  const oppK = data && data[side === "home" ? "away" : "home"].keeper;
  const oppSkilled = !!(oppK && oppK.logit);
  st.takers.forEach((t, i) => {
    const pt = payloadTaker(side, t.key);
    const noSkill = pt ? pt.no_skill : false;
    const sk = skillSpan(t._pSkill, "taker");
    const pm = t._pMean != null && oppSkilled
      ? `<span class="pm" title="${T("shootout.vsGkTitle", { name: esc(oppK.name) })}">` +
        `${T("shootout.vsGk", { p: pct(t._pMean) })}</span>` : "";
    const flag = noSkill
      ? `<span class="flag" title="${T("shootout.takerNoRecord")}">${T("shootout.noRecord")}</span>` : "";
    const unused = nEff > 0 && i >= nEff;
    const row = document.createElement("div");
    row.className = "tk-row" + (unused ? " unused" : "");
    if (unused) row.title = T("shootout.unusedTitle");
    row.innerHTML = `<span class="num">${i + 1}.</span><span class="nm">${esc(t.name || t.key)}</span>` +
      `${flag}${sk}${pm}` +
      `<button data-act="up" title="${T("shootout.moveUp")}" ${i === 0 ? "disabled" : ""}>↑</button>` +
      `<button data-act="dn" title="${T("shootout.moveDown")}" ${i === st.takers.length - 1 ? "disabled" : ""}>↓</button>` +
      `<button data-act="x" title="${T("shootout.remove")}">✕</button>`;
    row.querySelector('[data-act="up"]').onclick = () => {
      [st.takers[i - 1], st.takers[i]] = [st.takers[i], st.takers[i - 1]];
      st.manual = true; update();
    };
    row.querySelector('[data-act="dn"]').onclick = () => {
      [st.takers[i + 1], st.takers[i]] = [st.takers[i], st.takers[i + 1]];
      st.manual = true; update();
    };
    row.querySelector('[data-act="x"]').onclick = () => {
      st.takers.splice(i, 1); update();
    };
    list.appendChild(row);
  });
  $(`${side}-order-note`).textContent = st.takers.length
    ? T(st.manual ? "shootout.orderCustom" : "shootout.orderBySkillNote") : "";
  $(`first-${side}`).textContent = state.first === side ? T("shootout.kicksFirst") : "";
  // keep the first-kick dropdown labelled with the actual team names
  const opts = $("first-select").options;
  opts[1].textContent = tlabel("home");
  opts[2].textContent = tlabel("away");
}

["home", "away"].forEach((side) => {
  $(`${side}-sort`).onclick = () => { state[side].manual = false; update(); };
});

$("first-select").addEventListener("change", () => {
  state.first = $("first-select").value;
  syncUrl();
  renderTeam("home"); renderTeam("away");
  if (data && sim) simulateAndRender();
});

$("base-input").addEventListener("change", () => {
  let v = parseFloat($("base-input").value);
  if (!isFinite(v)) v = 72;
  v = Math.min(95, Math.max(40, v));
  $("base-input").value = v;
  state.base = v / 100;
  syncUrl();
  if (data) { applyPayload(); simulateAndRender(); }
});

// fun mode: allow the same taker several times in a roster. Turning it off
// dedupes each roster back to first appearances.
$("fun-toggle").addEventListener("change", () => {
  state.fun = $("fun-toggle").checked;
  if (!state.fun) {
    ["home", "away"].forEach((s) => {
      const seen = new Set();
      state[s].takers = state[s].takers.filter((t) => !seen.has(t.key) && seen.add(t.key));
    });
  }
  update();
});

// ── data fetch ───────────────────────────────────────────────────────────────
// The payload depends on the taker SETS and the keepers, not the order — so a
// reorder, removal, or baseline change re-simulates from the cached payload.
function sig() {
  const keys = (s) => state[s].takers.map((t) => t.key).sort().join(",");
  return `${keys("home")}|${keys("away")}|${state.home.gk?.key || ""}|${state.away.gk?.key || ""}`;
}

function currentCovered() {
  if (!data) return false;
  return ["home", "away"].every((s) =>
    state[s].takers.every((t) => payloadTaker(s, t.key)));
}

// Returns true (payload ready), false (failed — hide results), or "superseded"
// (the roster changed while the fetch was in flight; whatever update() ran for
// that change owns the render, so the caller should do nothing).
let fetchSeq = 0;
async function ensureData() {
  if (sig() === fetchedSig && data) return true;
  if (fetchedSig !== null && currentCovered() &&
      (state.home.gk?.key || "") === (data._gk.home) &&
      (state.away.gk?.key || "") === (data._gk.away)) return true;  // subset after removal
  // Snapshot what this request is FOR: the state can change mid-flight, and a
  // stale payload stored under the newer signature would silently drop modelled
  // takers to the no-record baseline. Store only if the roster still matches.
  const mySig = sig();
  const myToken = ++fetchSeq;
  const q = new URLSearchParams({
    home: state.home.takers.map((t) => t.key).join(","),
    away: state.away.takers.map((t) => t.key).join(","),
  });
  if (state.home.gk) q.set("home_gk", state.home.gk.key);
  if (state.away.gk) q.set("away_gk", state.away.gk.key);
  $("results").classList.add("busy");
  try {
    const resp = await fetch(`/api/shootout_data?${q}`);
    if (myToken !== fetchSeq || sig() !== mySig) return "superseded";
    if (!resp.ok) {
      $("err").textContent = (await resp.json()).detail ||
              T("shootout.errorStatus", { status: resp.status });
      return false;
    }
    const payload = await resp.json();
    if (myToken !== fetchSeq || sig() !== mySig) return "superseded";
    data = payload;
    data._gk = { home: state.home.gk?.key || "", away: state.away.gk?.key || "" };
    fetchedSig = mySig;
    $("err").textContent = "";
    applyPayload();
    return true;
  } catch (e) {
    if (myToken !== fetchSeq || sig() !== mySig) return "superseded";
    $("err").textContent = String(e);
    return false;
  } finally {
    if (myToken === fetchSeq) $("results").classList.remove("busy");
  }
}

// Per-taker goal-probability draws in the CURRENT roster order. Known takers
// use the server's paired draws; no-record takers are anchored at the
// adjustable baseline vs the average keeper, shifted by the opposing keeper's
// log-odds draws: p[i] = plogis(qlogis(base) + r_gk_opp[i]).
function pVectors(side) {
  const opp = side === "home" ? "away" : "home";
  const gkLogit = (data[opp].keeper && data[opp].keeper.logit) || null;
  const q = qlogis(state.base);
  return state[side].takers.map((t) => {
    const pt = payloadTaker(side, t.key);
    if (pt && pt.p) return pt.p;
    const n = data.n_draws;
    const v = new Float64Array(n);
    for (let i = 0; i < n; i++) v[i] = plogis(q + (gkLogit ? gkLogit[i] : 0));
    return v;
  });
}

// Fill in names (deep links arrive key-only), per-taker means, and — unless the
// user reordered by hand — sort each roster best-first.
function applyPayload() {
  // The no-record baseline's ⓘ quotes the model's own average rather than a
  // number pasted into the markup — same base_prob the badges and the export
  // caption read, so the page can't contradict itself after a refit.
  if (data && data.base_prob != null) {
    $("base-info").title =
      T("shootout.baseHintLive", { p: pct(data.base_prob) });
  }
  ["home", "away"].forEach((side) => {
    const ps = pVectors(side);
    state[side].takers.forEach((t, i) => {
      const pt = payloadTaker(side, t.key);
      if (pt && !t.name) t.name = pt.name;
      // skill headline vs the AVERAGE keeper (no-record takers sit exactly at
      // the adjustable baseline); _pMean below is vs the opposing keeper
      t._pSkill = pt && pt.p_skill != null ? pt.p_skill : state.base;
      const v = ps[i];
      let s = 0; for (let j = 0; j < v.length; j++) s += v[j];
      t._pMean = s / v.length;
    });
    if (state[side].gk && data[side].keeper && !state[side].gk.name) {
      state[side].gk.name = data[side].keeper.name;
    }
    if (!state[side].manual) {
      state[side].takers.sort((a, b) => b._pMean - a._pMean);
    }
  });
  renderTeam("home"); renderTeam("away");
}

// ── the Monte Carlo ──────────────────────────────────────────────────────────
// One shootout: best-of-5, alternating, TEAM 1 KICKS FIRST, stopping early once
// the trailing team cannot equalise; if level after 5 rounds, sudden-death
// pairs. The taker order cycles through each roster (round r -> taker r mod n),
// through both phases — the shootout continuation rule. Returns
// [score1, score2, team1Won, wasSuddenDeath].
function oneShootout(p1, p2, d) {
  let h = 0, a = 0;
  for (let r = 0; r < 5; r++) {
    if (Math.random() < p1[r % p1.length][d]) h++;
    // either side can clinch after either kick (a miss shrinks the opponent's
    // reachable total too): team 1 has 4-r kicks left here, team 2 has 5-r
    if (h > a + (5 - r)) return [h, a, 1, 0];
    if (a > h + (4 - r)) return [h, a, 0, 0];
    if (Math.random() < p2[r % p2.length][d]) a++;
    if (h > a + (4 - r)) return [h, a, 1, 0];         // 4-r kicks left each
    if (a > h + (4 - r)) return [h, a, 0, 0];
  }
  if (h !== a) return [h, a, h > a ? 1 : 0, 0];
  for (let r = 5; r < 200; r++) {
    const gh = Math.random() < p1[r % p1.length][d];
    const ga = Math.random() < p2[r % p2.length][d];
    if (gh) h++; if (ga) a++;
    if (gh !== ga) return [h, a, gh ? 1 : 0, 1];
  }
  return [h, a, Math.random() < 0.5 ? 1 : 0, 1];      // never reached in practice
}

function simulate() {
  // laws of the game: teams must field equal numbers, so the bigger roster is
  // reduced to the smaller one's size (its takers past nEff never kick)
  const pHall = pVectors("home"), pAall = pVectors("away");
  const nEff = Math.min(pHall.length, pAall.length);
  const pH = pHall.slice(0, nEff), pA = pAall.slice(0, nEff);
  const nDraws = data.n_draws;
  const scores = new Map();  // "h-a" -> {h, a, n}
  let winsH = 0, sd = 0;
  for (let d = 0; d < nDraws; d++) {
    for (let s = 0; s < SIMS_PER_DRAW; s++) {
      // who kicks first: fixed, or a per-shootout coin toss. In this model the
      // order can't change who wins (kicks are independent — no pressure
      // effects), but it does change WHERE early stops land, i.e. the
      // scoreline distribution.
      const homeFirst = state.first === "home" ||
        (state.first === "coin" && Math.random() < 0.5);
      let h, a, hw, wasSd;
      if (homeFirst) [h, a, hw, wasSd] = oneShootout(pH, pA, d);
      else { const r = oneShootout(pA, pH, d); h = r[1]; a = r[0]; hw = 1 - r[2]; wasSd = r[3]; }
      winsH += hw; sd += wasSd;
      const k = `${h}-${a}`;
      let e = scores.get(k);
      if (!e) scores.set(k, e = { h, a, n: 0 });
      e.n++;
    }
  }
  const total = nDraws * SIMS_PER_DRAW;
  sim = {
    total, nEff,
    reduced: pHall.length !== pAall.length,
    pWinH: winsH / total,
    sdShare: sd / total,
    scores: [...scores.values()].sort((x, y) => y.n - x.n),
  };
}

// ── rendering ────────────────────────────────────────────────────────────────
function setup(cv, cssH) {
  const r = window.devicePixelRatio || 1, w = cv.clientWidth;
  if (cssH != null) cv.style.height = cssH + "px";
  const h = cssH != null ? cssH : cv.clientHeight;
  cv.width = w * r; cv.height = h * r;
  const ctx = cv.getContext("2d");
  ctx.setTransform(r, 0, 0, r, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return [ctx, w, h];
}

function drawWinBar(target) {
  const [ctx, w, h] = target || setup($("winbar"));
  const pH = sim.pWinH, pA = 1 - pH;
  const font = "IBM Plex Sans, sans-serif";

  // headline: team name (its colour) + big win % (ink) at each end
  ctx.textBaseline = "alphabetic";
  ctx.font = `600 12px ${font}`;
  ctx.fillStyle = COL_H; ctx.textAlign = "left"; ctx.fillText(tlabel("home"), 0, 14);
  ctx.fillStyle = COL_A; ctx.textAlign = "right"; ctx.fillText(tlabel("away"), w, 14);
  ctx.font = `600 22px ${font}`; ctx.fillStyle = INK;
  ctx.textAlign = "left"; ctx.fillText(pct(pH), 0, 38);
  ctx.textAlign = "right"; ctx.fillText(pct(pA), w, 38);

  // 100% split bar, 2px surface gap between the fills, 4px rounded outer ends
  const y = 48, bh = 16, gap = 2, r4 = 4;
  const wH = Math.max(0, (w - gap) * pH);
  ctx.fillStyle = COL_H;
  ctx.beginPath(); ctx.roundRect(0, y, wH, bh, [r4, 0, 0, r4]); ctx.fill();
  ctx.fillStyle = COL_A;
  ctx.beginPath(); ctx.roundRect(wH + gap, y, w - wH - gap, bh, [0, r4, r4, 0]); ctx.fill();
  ctx.textAlign = "left";
}

function drawScorelines(target) {
  const rows = sim.scores.slice(0, 12);
  const rowH = 26, padTop = 4;
  const [ctx, w, h] = target || setup($("scorelines"), padTop + rows.length * rowH + 6);
  const font = "IBM Plex Sans, sans-serif";
  const gutter = 44, tipRoom = 46;
  const maxShare = rows[0].n / sim.total;
  const x0 = gutter, x1 = w - tipRoom;
  ctx.textBaseline = "middle";

  // baseline hairline (solid, recessive)
  ctx.strokeStyle = LINE; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0 - 0.5, padTop); ctx.lineTo(x0 - 0.5, padTop + rows.length * rowH); ctx.stroke();

  rows.forEach((e, i) => {
    const y = padTop + i * rowH + rowH / 2;
    const share = e.n / sim.total;
    const bw = Math.max(1.5, (share / maxShare) * (x1 - x0));
    ctx.fillStyle = MUTED; ctx.font = `12px ${font}`; ctx.textAlign = "right";
    ctx.fillText(`${e.h}–${e.a}`, gutter - 8, y);
    ctx.fillStyle = e.h > e.a ? COL_H : COL_A;
    ctx.beginPath(); ctx.roundRect(x0, y - 8, bw, 16, [0, 4, 4, 0]); ctx.fill();
    ctx.fillStyle = INK; ctx.font = `11px ${font}`; ctx.textAlign = "left";
    ctx.fillText(pct(share), x0 + bw + 6, y);
  });
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
}

function renderResults() {
  $("placeholder").hidden = true;
  $("results").hidden = false;
  $("snap").hidden = false;
  const [lead, p] = sim.pWinH >= 0.5 ? ["home", sim.pWinH] : ["away", 1 - sim.pWinH];
  const bold = (t) => `<b style="color:${COL[lead]}">${t}</b>`;
  $("verdict").innerHTML = T("shootout.verdict", {
    team: bold(esc(tlabel(lead))), p: bold(pct(p)),
  });
  $("verdict-sub").textContent = T("shootout.verdictSub", {
    reduced: sim.reduced ? T("shootout.reducedNote", { n: sim.nEff }) : "",
    sd: pct(sim.sdShare), first: firstKickNote(),
    n: sim.total.toLocaleString(), draws: data.n_draws.toLocaleString(),
  });
  $("sc-sub").textContent =
    T("shootout.scorelinesSubLive", { team: tlabel("home") });
  drawWinBar();
  drawScorelines();

  $("sc-body").innerHTML = sim.scores.map((e) => {
    const win = e.h > e.a ? "home" : "away";
    return `<tr><td>${e.h}–${e.a}</td>` +
      `<td style="white-space:nowrap"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${COL[win]};margin-right:5px"></span>${esc(tlabel(win))}</td>` +
      `<td>${(100 * e.n / sim.total).toFixed(2)}%</td></tr>`;
  }).join("");

  $("note").textContent = T("shootout.note", { p: pct(data.base_prob) });
}

// "coin toss" or "<team> kicks first" — the sub-line and the export both say it
function firstKickNote() {
  return state.first === "coin"
    ? T("shootout.firstCoinNote")
    : T("shootout.firstTeamNote", { team: tlabel(state.first) });
}

function simulateAndRender() { simulate(); renderResults(); }

// ── PNG export: title + verdict + win bar + rosters + scorelines (same
// re-rendered-scene approach as compare.js / matches.js) ─────────────────────
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

// Export caption: just the shootout settings + link — no model/method talk.
function modelCaption() {
  let s = T("shootout.capSettings", {
    first: firstKickNote(),
    reduced: sim && sim.reduced ? T("shootout.capReduced", { n: sim.nEff }) : "",
    base: pct(state.base, 0),
  });
  return s + " " + T("caption.more");
}

function exportPng() {
  const SC = 2, W = 880, padX = 26, chartW = W - 2 * padX, lineH = 14;
  const colW = (chartW - 20) / 2;

  const meas = document.createElement("canvas").getContext("2d");
  meas.font = `11px ${SANS}`;
  const noteLines = wrapText(meas, modelCaption(), chartW);

  const nRows = Math.max(state.home.takers.length, state.away.takers.length) + 1; // + keeper
  const winTop = 104, winH = 68;
  const rosterTop = winTop + winH + 8, rosterH = 20 + nRows * 16 + 6;
  const scRows = Math.min(12, sim.scores.length);
  const scH = 4 + scRows * 26 + 6;
  const scTop = rosterTop + rosterH + 12;
  const footTop = scTop + 24 + scH + 14;
  const H = footTop + 10 + noteLines.length * lineH + 12;

  const out = document.createElement("canvas");
  out.width = W * SC; out.height = Math.round(H * SC);
  const ctx = out.getContext("2d");
  ctx.scale(SC, SC);
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";

  // title + sub
  ctx.fillStyle = INK; ctx.font = `700 24px ${DISPLAY}`;
  ctx.fillText(T("shootout.pngVs", { home: tlabel("home"), away: tlabel("away") }), padX, 36);
  ctx.fillStyle = MUTED; ctx.font = `12.5px ${SANS}`;
  ctx.fillText(T("shootout.pngSubtitle"), padX, 56);

  // verdict line, leading team coloured
  const [lead, prob] = sim.pWinH >= 0.5 ? ["home", sim.pWinH] : ["away", 1 - sim.pWinH];
  let x = padX;
  const seg = (t, col, font) => {
    ctx.font = font; ctx.fillStyle = col;
    ctx.fillText(t, x, 86); x += ctx.measureText(t).width;
  };
  // the page's verdict sentence, split on its {placeholders} so the team and
  // the probability keep the leader's colour
  const strong = { team: tlabel(lead), p: pct(prob) };
  for (const tok of T.raw("shootout.verdict").split(/(\{\w+\})/)) {
    const key = tok.startsWith("{") && tok.slice(1, -1);
    if (key && key in strong) seg(strong[key], COL[lead], `700 16px ${SANS}`);
    else seg(tok, INK, `15px ${SANS}`);
  }

  // offscreen re-render helper (2x), as in compare.js
  const off = (w, h, drawFn) => {
    const cv = document.createElement("canvas");
    cv.width = w * SC; cv.height = h * SC;
    const c = cv.getContext("2d");
    c.setTransform(SC, 0, 0, SC, 0, 0);
    drawFn([c, w, h]);
    return cv;
  };
  ctx.drawImage(off(chartW, winH, (t) => drawWinBar(t)), padX, winTop, chartW, winH);

  // rosters: keeper + takers in kicking order, with the ▲/▼ skill badge (vs
  // the average opponent) and, when the opposing keeper is modelled, the
  // expected P(goal) against that keeper
  [["home", padX], ["away", padX + colW + 20]].forEach(([side, cx0]) => {
    ctx.fillStyle = COL[side]; ctx.font = `700 13px ${SANS}`;
    ctx.fillText(tlabel(side) +
      (state.first === side ? T("shootout.pngKicksFirst") : ""), cx0, rosterTop + 12);
    ctx.font = `11.5px ${SANS}`;
    const gk = state[side].gk;
    ctx.fillStyle = MUTED;
    ctx.fillText(T("shootout.pngGk", {
      name: gk ? gk.name : T("shootout.pngGkAverage") }), cx0, rosterTop + 30);
    const pk = data[side].keeper;
    if (gk && pk && pk.key === gk.key && pk.p_avg_taker != null) {
      const up = pk.p_avg_taker < data.base_prob;
      ctx.fillStyle = up ? SK_UP : SK_DOWN; ctx.textAlign = "right";
      ctx.fillText(`${up ? "▲" : "▼"}${pct(pk.p_avg_taker)}`, cx0 + colW, rosterTop + 30);
      ctx.textAlign = "left";
    }
    const oppK = data[side === "home" ? "away" : "home"].keeper;
    const oppSkilled = !!(oppK && oppK.logit);
    state[side].takers.forEach((t, i) => {
      const unused = i >= sim.nEff;
      const y = rosterTop + 30 + (i + 1) * 16;
      ctx.fillStyle = unused ? "#b9bfc7" : INK;
      ctx.fillText(T("shootout.pngRoster", {
        i: i + 1, name: t.name || t.key,
        unused: unused ? T("shootout.pngUnused") : "" }), cx0, y);
      if (t._pSkill != null && !unused) {
        ctx.textAlign = "right";
        let rx = cx0 + colW;
        if (oppSkilled && t._pMean != null) {
          ctx.fillStyle = MUTED;
          const vsGk = T("shootout.vsGk", { p: pct(t._pMean) });
          ctx.fillText(vsGk, rx, y);
          rx -= ctx.measureText(vsGk).width + 10;
        }
        const up = t._pSkill > data.base_prob;
        ctx.fillStyle = up ? SK_UP : SK_DOWN;
        ctx.fillText(`${up ? "▲" : "▼"}${pct(t._pSkill)}`, rx, y);
        ctx.textAlign = "left";
      }
    });
  });

  // scoreline chart with its on-page title
  ctx.fillStyle = INK; ctx.font = `600 13px ${SANS}`;
  ctx.fillText(T("shootout.pngScorelines"), padX, scTop + 14);
  ctx.drawImage(off(chartW, scH, (t) => drawScorelines(t)), padX, scTop + 22, chartW, scH);

  // footer
  ctx.strokeStyle = "#e7e8ec"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padX, footTop + 0.5); ctx.lineTo(W - padX, footTop + 0.5); ctx.stroke();
  ctx.fillStyle = MUTED; ctx.font = `11px ${SANS}`;
  noteLines.forEach((ln, i) => ctx.fillText(ln, padX, footTop + 16 + i * lineH));

  const a = document.createElement("a");
  a.href = out.toDataURL("image/png");
  a.download = `shootout-${slug(tlabel("home"))}-vs-${slug(tlabel("away"))}.png`;
  a.click();
}
$("snap").onclick = () => { if (sim) exportPng(); };

window.addEventListener("resize", () => {
  if (sim && !$("results").hidden) { drawWinBar(); drawScorelines(); }
});

// ── orchestration + deep links ───────────────────────────────────────────────
function syncUrl() {
  const q = new URLSearchParams();
  if (state.home.takers.length) q.set("home", state.home.takers.map((t) => t.key).join(","));
  if (state.away.takers.length) q.set("away", state.away.takers.map((t) => t.key).join(","));
  if (state.home.gk) q.set("home_gk", state.home.gk.key);
  if (state.away.gk) q.set("away_gk", state.away.gk.key);
  if (state.home.label) q.set("home_label", state.home.label);
  if (state.away.label) q.set("away_label", state.away.label);
  if (state.first !== "coin") q.set("first", state.first);
  if (Math.round(state.base * 100) !== 72) q.set("base", Math.round(state.base * 100));
  if (state.fun) q.set("fun", "1");
  history.replaceState(null, "", q.size ? `?${q}` : location.pathname);
}

async function update() {
  renderTeam("home"); renderTeam("away");
  syncUrl();
  if (!state.home.takers.length || !state.away.takers.length) {
    $("results").hidden = true; $("placeholder").hidden = false; $("snap").hidden = true;
    return;
  }
  const got = await ensureData();
  if (got === true) simulateAndRender();
  else if (got === false) { $("results").hidden = true; $("placeholder").hidden = false; $("snap").hidden = true; }
  // "superseded": a newer update() owns the render — leave the UI alone
}

(function initFromUrl() {
  const p = new URLSearchParams(location.search);
  const keys = (s) => (p.get(s) || "").split(",").filter(Boolean).slice(0, MAX_TAKERS);
  state.home.takers = keys("home").map((k) => ({ key: k, name: "" }));
  state.away.takers = keys("away").map((k) => ({ key: k, name: "" }));
  if (p.get("home_gk")) state.home.gk = { key: p.get("home_gk"), name: "" };
  if (p.get("away_gk")) state.away.gk = { key: p.get("away_gk"), name: "" };
  if (p.get("home_label")) state.home.label = p.get("home_label");
  if (p.get("away_label")) state.away.label = p.get("away_label");
  if (["home", "away"].includes(p.get("first"))) {
    state.first = p.get("first");
    $("first-select").value = state.first;
  }
  const b = parseInt(p.get("base"), 10);
  if (b >= 40 && b <= 95) { state.base = b / 100; $("base-input").value = b; }
  // fun mode from the URL — or implied by a deep link with duplicate takers
  state.fun = p.get("fun") === "1" || ["home", "away"].some(
    (s) => new Set(state[s].takers.map((t) => t.key)).size !== state[s].takers.length);
  $("fun-toggle").checked = state.fun;
  update();
})();
