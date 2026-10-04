// Static API shim. The pages were written against the private dashboard's
// FastAPI endpoints; this script (loaded BEFORE app.js / compare.js /
// shootout.js) overrides window.fetch for "/api/..." URLs and serves them from
// the exported JSON under data/ instead. Search filtering runs client-side
// over the exported indexes, and the two endpoints that were computed
// server-side — /api/compare and /api/shootout_data — are ported here: they
// only ever combined per-player posterior draws, which export_static.py ships
// per subject (thinned x4, ints x1e4, aligned with data/draws/b0.json).
//
// Every payload shape matches server.py exactly, including {detail} error
// bodies with real HTTP status codes, so the page code runs unmodified.
//
// Ships in BOTH deployments. The fetch override only activates when config.js
// says the target is static; on the private dashboard the real /api endpoints
// stay untouched. The math/draws helpers on window.__shim are exposed in both
// modes though — the player card's standardized skill tiles use them, reading
// draws from data/draws/… (static) or /api/draws/… (private), same payload
// shape either way.
"use strict";
(() => {
  const STATIC = !!(window.PENALTY_CONFIG || {}).static;
  const realFetch = window.fetch.bind(window);
  const files = new Map();          // path -> Promise<parsed JSON>

  function j(path) {
    if (!files.has(path)) {
      files.set(path, realFetch(path).then((r) => {
        if (!r.ok) { files.delete(path); const e = new Error(path); e.status = r.status; throw e; }
        return r.json();
      }, (e) => { files.delete(path); throw e; }));
    }
    return files.get(path);
  }
  const maybe = (path) => j(path).catch(() => null);   // 404 -> null

  const ok = (obj) => new Response(JSON.stringify(obj), {
    status: 200, headers: { "Content-Type": "application/json" } });
  const fail = (status, detail) => new Response(JSON.stringify({ detail }), {
    status, headers: { "Content-Type": "application/json" } });
  const httpErr = (status, detail) => {
    const e = new Error(detail); e.status = status; e.detail = detail; return e;
  };

  // ---- name normalisation (matches server.py norm_sql/norm_py semantics:
  // the exported names are matched accent-stripped, folded, ws-collapsed; we
  // also strip accents from the QUERY, which the server never did — a strict
  // improvement: "Özil" now finds Özil) -------------------------------------
  const FOLD = [["ı", "i"], ["ø", "o"], ["đ", "d"], ["ł", "l"], ["ß", "ss"],
                ["æ", "ae"], ["œ", "oe"], ["ð", "d"], ["þ", "th"]];
  function norm(s) {
    s = String(s || "").toLowerCase().trim();
    for (const [a, b] of FOLD) s = s.split(a).join(b);
    return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ");
  }
  // subject keys are tm123 / ws123 — plus ws123.0 (gk_id is a DOUBLE upstream)
  const KEY_OK = /^[a-z]{2}\d+(\.\d+)?$/;

  // ---- math helpers (ports of server.py) -----------------------------------
  const plogis = (x) => 1 / (1 + Math.exp(-x));
  const qlogis = (p) => Math.log(p / (1 - p));
  const r4 = (x) => Math.round(x * 1e4) / 1e4;
  // _quantile (server.py:1355): index floor(p*n), clamped
  const quantile = (sorted, p) =>
    sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  // Abramowitz & Stegun 7.1.26 (|err| < 1.5e-7); JS has no Math.erf
  function erf(x) {
    const s = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
      - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  // _kde (server.py:1359): Gaussian KDE, Silverman bandwidth, even n-grid
  function kde(xs, x0, x1, n = 128) {
    const m = xs.length;
    const mu = xs.reduce((a, b) => a + b, 0) / m;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / (m - 1));
    const srt = [...xs].sort((a, b) => a - b);
    const iqr = quantile(srt, 0.75) - quantile(srt, 0.25);
    const h = 0.9 * Math.min(sd, iqr > 0 ? iqr / 1.34 : sd) * m ** -0.2 || 1e-9;
    const inv = 1 / (2 * h * h), ys = [];
    for (let i = 0; i < n; i++) {
      const g = x0 + (i / (n - 1)) * (x1 - x0);
      let s = 0;
      for (const x of xs) { const d = g - x; s += Math.exp(-d * d * inv); }
      ys.push(s / (m * h * Math.sqrt(2 * Math.PI)));
    }
    return ys;
  }

  // ---- per-subject data -----------------------------------------------------
  const detail = (role, key) =>
    j(`data/${role === "taker" ? "player" : "keeper"}/${key}.json`);
  // random-effect draws on the log-odds scale, de-quantized (null if
  // unmodelled). Every displayed estimand is a per-draw transform of these
  // with the fixed-effect draws in b0.json (same thin indices, so i pairs
  // with i across every player — that joint alignment is the whole game).
  const rDraws = (role, key) =>
    maybe(STATIC ? `data/draws/${role}/${key}.json` : `/api/draws/${role}/${key}`)
      .then((d) => d && d.r.map((v) => v / d.scale));
  const fixedEffects = () => maybe(STATIC ? "data/draws/b0.json" : "/api/draws/b0");

  // RE draws -> added-probability draws for one estimand, per joint draw.
  // Port of server.py _added_draws(): "marginal" is the published skill figure
  // (the w-weighted in-game/shootout mixture vs its own baseline); the other
  // two hold the kick type fixed. All monotone in r, so ranks are shared.
  function addedDraws(r, fe, estimand) {
    const n = Math.min(r.length, fe.b0.length), w = fe.w_shootout;
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
      const b0 = fe.b0[i], bso = fe.b_so[i];
      if (estimand === "in_game") out[i] = plogis(b0 + r[i]) - plogis(b0);
      else if (estimand === "shootout")
        out[i] = plogis(b0 + bso + r[i]) - plogis(b0 + bso);
      else out[i] = (1 - w) * (plogis(b0 + r[i]) - plogis(b0))
                  + w * (plogis(b0 + bso + r[i]) - plogis(b0 + bso));
    }
    return out;
  }

  // ---- /api/compare (port of server.py compare()) ---------------------------
  async function compareSide(role, key, fe, estimand) {
    if (!KEY_OK.test(key)) throw httpErr(404, `no skill estimate for ${role} '${key}'`);
    const d = await detail(role, key).catch(() => null);
    if (!d || !d.skill) throw httpErr(404, `no skill estimate for ${role} '${key}'`);
    const r = await rDraws(role, key);
    if (!r) throw httpErr(503, "penalty_skill_draws not published yet");
    const draws = addedDraws(r, fe, estimand);
    const sk = d.skill, tm = d.tm;
    const side = {
      key, name: d.name,
      median_added: sk.median, q025_added: sk.q025, q975_added: sk.q975,
      dens: sk.dens, rank: sk.rank, n_ranked: sk.n_ranked, base_prob: sk.base_prob,
      pens: tm ? (role === "taker" ? tm.taken : tm.faced) : 0,
      goals: tm ? (role === "taker" ? tm.scored : tm.conceded) : 0,
    };
    if (estimand !== "marginal") {
      // standardized summaries + density from the same draws (the exported
      // detail file only carries the marginal summary); ranks are shared
      const s = [...draws].sort((x, y) => x - y);
      const lo = quantile(s, 0.005), hi = quantile(s, 0.995);
      const pad = 0.04 * (hi - lo) || 1e-6;
      const x0 = lo - pad, x1 = hi + pad;
      const step = Math.max(1, Math.floor(s.length / 2000));
      side.median_added = quantile(s, 0.5);
      side.q025_added = quantile(s, 0.025);
      side.q975_added = quantile(s, 0.975);
      side.dens = { x_min: x0, x_max: x1, n: 128,
                    y: kde(s.filter((_, i) => i % step === 0), x0, x1) };
      side.base_prob = estimand === "in_game" ? fe.base_prob_ig : fe.base_prob_so;
    }
    return { side, draws };
  }

  async function compare(role, a, b, estimand) {
    if (role !== "taker" && role !== "keeper")
      throw httpErr(400, "role must be 'taker' or 'keeper'");
    estimand = ["marginal", "in_game", "shootout"].includes(estimand) ? estimand : "marginal";
    const fe = await fixedEffects();
    if (!fe) throw httpErr(503, "fixed-effect draws not exported");
    const [A, B] = await Promise.all([
      compareSide(role, a, fe, estimand), compareSide(role, b, fe, estimand)]);
    const da = A.draws, db = B.draws;
    const n = Math.min(da.length, db.length);
    const sign = role === "taker" ? 1 : -1;
    const diff = new Array(n);
    for (let i = 0; i < n; i++) diff[i] = sign * (da[i] - db[i]);

    const p_raw = diff.filter((d) => d > 0).length / n;
    const mu = diff.reduce((x, y) => x + y, 0) / n;
    const sd = Math.sqrt(diff.reduce((x, y) => x + (y - mu) ** 2, 0) / (n - 1));
    const p_smooth = sd > 0 ? 0.5 * (1 + erf(mu / (sd * Math.SQRT2))) : +(mu > 0);

    for (const [side, dd] of [[A.side, da], [B.side, db]]) {
      const s = dd.slice(0, n).sort((x, y) => x - y);
      side.q17_added = quantile(s, 0.17);
      side.q83_added = quantile(s, 0.83);
    }

    diff.sort((x, y) => x - y);
    const q = (p) => quantile(diff, p);
    const lo = q(0.005), hi = q(0.995);
    const pad = 0.04 * (hi - lo) || 1e-6;
    const x0 = lo - pad, x1 = hi + pad, nBins = 60, dx = (x1 - x0) / nBins;
    const counts = new Array(nBins).fill(0);
    for (const d of diff) counts[Math.min(nBins - 1, Math.max(0, Math.floor((d - x0) / dx)))]++;

    const absAll = [];
    for (const xs of [da.slice(0, n), db.slice(0, n), diff])
      for (const x of xs) absAll.push(Math.abs(x));
    absAll.sort((x, y) => x - y);
    const half_w = 1.1 * quantile(absAll, 0.99);

    const step = Math.max(1, Math.floor(n / 2000));
    const dens_y = kde(diff.filter((_, i) => i % step === 0), -half_w, half_w);

    return {
      role, estimand, n_draws: n,
      mc_se_raw: Math.sqrt(p_raw * (1 - p_raw) / n),
      a: A.side, b: B.side, half_w,
      p_a_better: p_raw, p_a_better_smooth: p_smooth,
      diff: { median: q(0.5), q025: q(0.025), q975: q(0.975),
              q17: q(0.17), q83: q(0.83), mean: mu, sd,
              dens: { x_min: -half_w, x_max: half_w, y: dens_y },
              hist: { x0, dx, counts } },
    };
  }

  // ---- /api/shootout_data (port of server.py) --------------------------------
  // All simulator probabilities are SHOOTOUT-standardized: the model's
  // shootout intercept is b0 + b_so per draw (the skill tiles quote the
  // marginal estimand instead — two different published baselines, see
  // b0.json's base_prob vs base_prob_so).
  const MAX_TAKERS = 11;

  async function shootoutKeeper(key, bSo) {
    if (!key) return null;
    if (!KEY_OK.test(key)) throw httpErr(404, `keeper '${key}' not found`);
    const d = await maybe(`data/keeper/${key}.json`);
    const logit = await rDraws("keeper", key);
    const out = { key, name: d ? d.name : null, no_skill: logit === null,
                  logit: logit && logit.map(r4) };
    if (logit) {
      let s = 0;
      for (let i = 0; i < logit.length; i++) s += plogis(bSo[i] + logit[i]);
      out.p_avg_taker = r4(s / logit.length);
    }
    return out;
  }

  async function shootoutData(p) {
    const fe = await fixedEffects();
    if (!fe) throw httpErr(503, "shootout data not exported");
    // the per-draw shootout intercept
    const bSo = fe.b0.map((b, i) => b + fe.b_so[i]);

    async function side(takerCsv, ownGk, oppGk) {
      const keys = (takerCsv || "").split(",").filter(Boolean);
      if (keys.length < 1 || keys.length > MAX_TAKERS)
        throw httpErr(400, `each team needs 1-${MAX_TAKERS} takers`);
      const [keeper, opp] = await Promise.all([
        shootoutKeeper(ownGk, bSo), shootoutKeeper(oppGk, bSo)]);
      const rg = (opp && opp.logit) || null;
      const takers = await Promise.all(keys.map(async (k) => {
        if (!KEY_OK.test(k)) throw httpErr(404, `taker '${k}' not found`);
        const d = await maybe(`data/player/${k}.json`);
        const rt = await rDraws("taker", k);
        const t = { key: k, name: d ? d.name : null, no_skill: rt === null };
        if (rt) {
          const pv = new Array(rt.length);
          let sMean = 0, sSkill = 0;
          for (let i = 0; i < rt.length; i++) {
            pv[i] = r4(plogis(bSo[i] + rt[i] + (rg ? rg[i] : 0)));
            sMean += pv[i];
            sSkill += plogis(bSo[i] + rt[i]);
          }
          t.p = pv;
          t.p_mean = r4(sMean / rt.length);
          t.p_skill = r4(sSkill / rt.length);
        }
        return t;
      }));
      return { keeper, takers };
    }

    const [home, away] = await Promise.all([
      side(p.get("home"), p.get("home_gk") || "", p.get("away_gk") || ""),
      side(p.get("away"), p.get("away_gk") || "", p.get("home_gk") || ""),
    ]);
    return { n_draws: fe.b0.length, base_prob: fe.base_prob_so, home, away };
  }

  // ---- search over the exported indexes -------------------------------------
  async function searchSubjects(plural, q, limit) {
    const idx = await j(`data/${plural}_index.json`);   // sorted by count desc
    const qn = norm(q || "");
    const out = [];
    const cnt = plural === "players" ? "taken" : "faced";
    for (const e of idx) {                 // entries: {k, n(ame), t(count), h(int), s}
      if (qn && !norm(e.n).includes(qn)) continue;
      out.push({ key: e.k, name: e.n, [cnt]: e.t, hint: e.h });
      if (out.length >= limit) break;
    }
    return out;
  }

  async function searchTeams(q, limit) {
    const idx = await j("data/teams_index.json");   // nations first, n desc
    const qn = norm(q || "");
    const hit = qn ? idx.filter((t) => norm(t.name).includes(qn)) : idx;
    const nats = hit.filter((t) => t.type === "nation").slice(0, limit);
    const clubs = hit.filter((t) => t.type === "club").slice(0, limit);
    return [...nats, ...clubs].slice(0, limit);
  }

  // ---- routing ---------------------------------------------------------------
  async function route(pathname, params) {
    const m = pathname.match(/^\/api\/(.+)$/);
    const parts = m[1].split("/");
    const q = params.get("q") || "";
    const limit = parseInt(params.get("limit"), 10);

    switch (parts[0]) {
      case "players":
      case "keepers":
        if (parts.length === 1)
          return ok(await searchSubjects(parts[0], q, limit || 30));
        if (parts[1] === "table")
          return ok(await j(`data/${parts[0]}_table.json`));
        break;
      case "player":
      case "keeper":
        if (parts.length === 2 && KEY_OK.test(parts[1])) {
          const d = await maybe(`data/${parts[0]}/${parts[1]}.json`);
          return d ? ok(d) : fail(404, `${parts[0]} not found`);
        }
        break;                       // shots/penalties/opportunities: not public
      case "compare":
        return ok(await compare(params.get("role"), params.get("a"), params.get("b"),
                                params.get("estimand") || "marginal"));
      case "shootout_data":
        return ok(await shootoutData(params));
      case "teams":
        return ok(await searchTeams(q, limit || 12));
      case "team_roster": {
        const type = params.get("type"), id = params.get("id") || "";
        if (type !== "club" && type !== "nation")
          return fail(400, "type must be 'club' or 'nation'");
        // roster filenames carry the slug exported per teams_index entry, so
        // there is no client-side twin of export_static.py's team_slug()
        const idx = await j("data/teams_index.json");
        const t = idx.find((e) => e.type === type && String(e.id) === id);
        const r = t && await maybe(`data/team/${type}-${t.slug}.json`);
        return r ? ok(r) : fail(404, `unknown team '${id}'`);
      }
      case "xg_grid":
        return ok(await j("data/xg_grid.json"));
      case "model_info":
      case "site_meta":
        return ok(await j("data/site_meta.json"));
      case "models":
        return ok(await j("data/models.json"));
      case "competitions":
        return ok(await j("data/competitions.json"));
    }
    return fail(404, `not available on the static site: ${pathname}`);
  }

  // exposed for parity tests / console poking — and for app.js's standardized
  // estimand tiles, which reuse the draws plumbing + KDE (both deployments)
  window.__shim = { norm, kde, erf, quantile, rDraws, fixedEffects, addedDraws };

  if (!STATIC) return;  // private dashboard: real /api endpoints stay untouched
  Object.assign(window.__shim, { compare, shootoutData });

  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : input.url;
    let u;
    try { u = new URL(url, location.href); } catch { return realFetch(input, init); }
    if (!u.pathname.startsWith("/api/")) return realFetch(input, init);
    return route(u.pathname, u.searchParams).catch((e) =>
      fail(e.status || 500, e.detail || String(e)));
  };
})();
