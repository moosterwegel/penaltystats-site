// EVERY piece of user-facing prose on the site, in one place. Nothing else in
// the frontend should contain a sentence: pages carry empty elements tagged
// `data-copy="key"`, scripts call `T("key", {vars})`, and both read from here.
// Edit the text below and reload — no build step.
//
// Loaded right after config.js on every page (before header.js and the page
// script), so the deployment's wording knobs are already in scope.
//
// ---------------------------------------------------------------------------
// Writing the text
//
//   * Values are HTML: <b>, <a>, <code> are fine (the copy is first-party and
//     is injected as innerHTML).
//   * {placeholders} are filled from, in order: the vars passed to T(), then
//     PENALTY_CONFIG. So {srcEvent}, {srcArchive}, {filteredLabel},
//     {modelDataNote}, {archiveSuffix} and {brand} always work and resolve to
//     the private dashboard's wording or the public site's, whichever this
//     deployment is — that split is what config.js exists for. An unresolved
//     {placeholder} is left visible on the page rather than blanked, so a typo
//     shows up instead of silently eating the sentence.
//   * A key that is missing renders as ⟨key⟩ for the same reason.
//
// Marking up a page
//
//   <p data-copy="about.data"></p>             -> innerHTML  = T("about.data")
//   <input data-copy-placeholder="takers.search">  -> placeholder attribute
//   <span data-copy-title="shootout.baseHint">    -> title attribute (tooltip)
//
// data-copy-<attr> works for any attribute; the element's own text is left
// alone. Pages that need a value at runtime (a player's name, a percentage)
// call T() from their script instead.
// ---------------------------------------------------------------------------

window.PENALTY_COPY = {
  // ---- shared -------------------------------------------------------------
  common: {
    loading: "Loading…",
    exportPng: "⤓ Export PNG",
    screenshot: "⤓ Screenshot",
    searchPlayer: "Search a player…",
    searchKeeper: "Search a goalkeeper…",
  },

  // nav labels (header.js builds the bar; config.js picks which entries show)
  nav: {
    takers: "Takers",
    keepers: "Goalkeepers",
    shotmap: "Shot map",
    compare: "Head to head",
    shootout: "Shootout simulator",
    heatmap: "Goal map",
    models: "Models",
    matches: "Match explorer",
    recent: "Recent",
    about: "About",
  },

  // browser tab titles
  titles: {
    takers: "{brand}",
    keepers: "{brand} — goalkeepers",
    compare: "{brand} — head to head",
    heatmap: "{brand} — goal-probability map",
    models: "{brand} — models",
    shootout: "{brand} — shootout simulator",
    matches: "{brand} — match explorer",
    recent: "{brand} — recent penalties",
    about: "{brand} — about & methods",
    shotmapTakers: "{brand} — takers shot map",
    shotmapKeepers: "{brand} — keepers shot map",
  },

  // "data through 2026-05 · updated monthly" in the page header
  meta: {
    dataThrough: "data through {latest} · updated monthly",
  },

  // ---- captions on the exported PNGs --------------------------------------
  // The screenshots travel on their own, so each carries a caption explaining
  // the picture. They are ASSEMBLED FROM THE SENTENCES BELOW rather than each
  // wording the same claim its own way: reword one here and every export that
  // makes that claim follows. Each export adds only what is unique to it.
  caption: {
    // what a mark on a goal-frame plot is
    marks: "Each mark is one penalty, drawn to ball scale where the ball crossed the goal line — not where it hit the net ({srcEvent}{through}); diamonds are kicks recorded outside the frame, pulled to the nearest edge.",
    through: ", through {date}",

    // the skill model (one phrasing, used by every export that shows a skill)
    skill: "{skill} is the percentage points (pp) of penalties they are estimated to {estimand}, from a Bayesian crossed random-effects model that adjusts for the quality of both shooter and keeper and for whether the kick came in-game or in a shootout (figures average over the sport-wide shootout share).",
    estimandTaker: "score above the average taker when facing the average goalkeeper",
    estimandKeeper: "stop above the average goalkeeper when facing the average taker",
    fit: "Fitted on {n} penalties from top-flight competitions worldwide since 1990/91 ({srcArchive}{through})",
    covering: ", covering {takers} takers and {keepers} goalkeepers.",

    // the wrong-way companion model
    ww: "{label} is the matching estimate of how often the {what}, fitted on {n} penalties with a recorded dive ({srcEvent}).",
    wwTaker: "taker sends the keeper the wrong way",
    wwKeeper: "keeper dives the right way",

    // the Dom/Mid/Non buckets
    splitTaker: "Shot placement is Dom (dominant side), Mid (central), Non (non-dominant), where the dominant side is the goal's left for right-footed takers and the right for left-footed takers.",
    splitKeeper: "Dive direction is Dom (dominant side), Mid (central), Non (non-dominant), where the dominant side is the goal's left for right-footed shooters and the right for left-footed shooters.",

    // post-shot expected goals
    psxg: "PSxG — post-shot expected goals — is the modelled chance a kick becomes a goal given its placement and the taker's foot, fitted on {n} on-target penalties ({srcEvent}).",
    psxgNoFit: "PSxG — post-shot expected goals — is the modelled chance a kick becomes a goal given its placement and the taker's foot ({srcEvent}).",

    pp: "pp = percentage point.",
    // every screenshot points back to the hub ({hub} lives in config.js)
    more: "More: {hub}",
  },

  // the public site's 404 (site-overlay/404.html). The only page whose text is
  // NOT here is site-overlay/takers.html — a redirect stub whose two words are
  // replaced by the redirect before anyone can read them.
  notFound: {
    title: "{brand} — not found",
    heading: "Over the bar.",
    body: "That page doesn't exist. <a href=\"/index.html\">Back to the start page</a>.",
  },

  // ---- takers / keepers tables + the player card (app.js) ------------------
  // One script drives both pages, so most keys come in a taker/keeper pair.
  takers: {
    back: "← all takers",
  },
  keepers: {
    back: "← all goalkeepers",
  },

  card: {
    // the line under the player's name: source coverage, foot, role
    srcBoth: "{srcEvent} + {srcArchive}",
    srcEventOnly: "{srcEvent} only",
    srcArchiveOnly: "{srcArchive} only",
    metaKeeper: "Goalkeeper · {src}",
    metaTaker: "{foot} · {src}",
    footed: "{foot}-footed",
    footUnknown: "Foot unknown",
    searchCount: "{n} pk",

    // profile tile
    profile: "Profile",
    worldCup: "⚽ At this World Cup",
    status: "Status",
    club: "Club",
    position: "Position",
    foot: "Foot",
    nation: "Nation",

    // headline count + rate tiles
    countLabelTaker: "Penalties",
    countLabelKeeper: "Penalties faced",
    goodLabelTaker: "scored",
    goodLabelKeeper: "kept out",
    rateLabelTaker: "Conversion",
    rateLabelKeeper: "Stop rate",
    globalAvg: "global avg {p}%",
    placementNote: "placement data for {n}/{denom} ({p})",

    // shoot-outs
    shootouts: "Shoot-outs",
    soGoodTaker: "converted",
    soGoodKeeper: "kept out",

    // "chosen to take" (takers only)
    chosen: "Chosen to take",
    chosenSub: "{taken}/{opps} team pens",
    chosenNote: "while on the pitch",

    // the two half-eye skill tiles
    skillTaker: "Penalty skill",
    skillKeeper: "Shot-stopping skill",
    wwTaker: "Deception skill",
    wwKeeper: "Reading skill",
    wwTitleTaker: "How much more often than the average taker they send the keeper the wrong way (pp), adjusting for the keepers faced. Fit on the penalties with a recorded dive.",
    wwTitleKeeper: "How much more often than the average keeper they dive the right way (pp), adjusting for the takers faced. Fit on the penalties with a recorded dive.",
    notModelled: "Not modelled",
    vsGlobal: "vs global avg",
    ciRank: "95% CI {lo} to {hi} · rank {rank}/{of} ({pctl})",
    ci: "95% CI {lo} to {hi}",
    pctlTop: "top {p}%",
    pctlBottom: "bottom {p}%",
    // the model's baseline, quoted under each skill tile. The keeper variant
    // of the wrong-way anchor quotes the right-way COMPLEMENT: that tile is
    // sign-flipped to "dives the right way", so the anchored average must be
    // on the same side of the coin.
    skillBase: "avg taker v avg keeper: {p}% scored",
    wwBase: "avg taker v avg keeper: {p}% wrong way",
    wwBaseKeeper: "avg keeper v avg taker: {p}% right way",

    // the two standardized companions of the headline (marginal) skill tile:
    // the same posterior, held at one penalty type. Drawn from the exported
    // per-player draws, so they only appear where those are served 
    skillTitle: "Added scoring probability vs the average opponent, averaged over how often penalties are shootout kicks across the sport ({w}%).",
    skillIngameTaker: "In-game skill",
    skillIngameKeeper: "In-game stopping",
    skillShootoutTaker: "Shootout skill",
    skillShootoutKeeper: "Shootout stopping",
    estIngameTitle: "The same posterior, standardized to in-game penalties: added scoring probability vs the average opponent if every kick were in-game.",
    estShootoutTitle: "The same posterior, standardized to shootout kicks: added scoring probability vs the average opponent if every kick were in a shootout.",
    estBaseIg: "avg taker v avg keeper: {p}% scored in-game",
    estBaseSo: "avg taker v avg keeper: {p}% scored in shootouts",

    // placement / dive split tiles
    splitTaker: "Shot placement",
    splitKeeper: "Dive direction",
    noPlacement: "No placement data",
    sideAbbr: "Dom = dominant side, Mid = central, Non = non-dominant — relative to the taker's stronger foot.",
    diveAbbr: "Dom = shooter's dominant side, Mid = central, Non = non-dominant — relative to the shooter's stronger foot.",
    shortDominant: "Dom",
    shortCentre: "Mid",
    shortNonDominant: "Non",
    leansDominant: "leans dominant",
    leansCentral: "leans central",
    leansNonDominant: "leans non-dominant",
    diveNote: "vs shooter's foot",
    splitGlobal: "{note} · global {split}",

    // post-shot xG tile
    psxg: "Post-shot xG ⓘ",
    psxgSub: "avg PSxG on target",
    psxgNoteTaker: "scored {p}% of {n} on target",
    psxgNoteKeeper: "conceded {p}% of {n} on target",
    psxgTitleTaker: "Average post-shot xG of the on-target penalties (scored or saved), next to the share actually scored. Scoring above PSxG can point to shot power or sending the keeper the wrong way; PSxG only sees where the ball crossed the line.",
    psxgTitleKeeper: "Average post-shot xG of the on-target penalties faced (scored or saved) — what placement alone expects a keeper to concede — next to the share actually conceded. Conceding less than PSxG can point to reading the taker or reach; PSxG only sees where the ball crossed the line.",
  },

  // the aggregate table: column headers, their tooltips, and the footer
  table: {
    loading: "Loading…",
    filterText: "filter",
    filterMin: "min",
    filterAll: "all",
    subjectTakers: "takers",
    subjectKeepers: "goalkeepers",
    count: "{n} {subject}",
    truncated: " · showing top {cap} — filter to narrow",

    colName: "Name",
    colFoot: "Foot",
    colPos: "Pos",
    colClub: "Club",
    colNat: "Nat",
    colWc: "WC",
    colPens: "Pens",
    colFaced: "Faced",
    colShootouts: "Sh-outs",
    colConv: "Conv %",
    colStop: "Stop %",
    colRightWay: "Right way %",
    colSavedIfRight: "Saved if right %",
    colOpps: "Opps",
    colSel: "Sel %",
    colPsxg: "PSxG",
    colVsExp: "vs exp",
    colSkill: "Skill (Δpp)",
    colWwTaker: "Deception (Δpp)",
    colWwKeeper: "Reading (Δpp)",
    colMed: "med",
    colLo: "q2.5",
    colHi: "q97.5",

    titleClub: "Current club (common suffixes like FC trimmed; hover for the full name); retired / unattached players show their status instead. Filter tip: type \"active\" for everyone currently at a club, \"retired\" for the retired.",
    titleNat: "National team",
    titleRightWay: "Of the penalties with a recorded placement and keeper action (event data), how often the keeper committed to the side the ball went — staying put counts as the centre.",
    titleSavedIfRight: "Save rate on the penalties where the keeper went the right way.",
    titleOpps: "Team penalties while this player was on the pitch (lineup data, filtered competitions). A shoot-out counts once per player — everyone must take before anyone goes twice.",
    titleSel: "Share of those opportunities the player took themselves",
    titlePsxgTaker: "Average goal probability of this player's on-target penalties, from placement alone (goal-probability model) — higher = better placement.",
    titlePsxgKeeper: "Average goal probability of the on-target penalties faced, from placement alone (goal-probability model).",
    titleVsExpTaker: "Goals per on-target kick vs what placement alone predicts — positive = converts those placements better than the average.",
    titleVsExpKeeper: "Goals prevented per on-target kick vs what placement alone predicts — positive = stops more than expected.",
    titleWwTaker: "How much more often than the average taker they send the keeper the wrong way, adjusting for the keepers faced.",
    titleWwKeeper: "How much more often than the average keeper they dive the right way, adjusting for the takers faced.",
    leagueAvgSuffix: " League average: {p}%.",

    // exported PNG of the table
    pngTitle: "All {subject}",
    pngGlobalAvg: "{label} global average: {p}%",
  },

  // ---- head to head -------------------------------------------------------
  compare: {
    brandSuffix: "head to head",
    roleTakers: "Takers",
    roleKeepers: "Keepers",

    // the estimand toggle: which standardization the pp scale uses. P(A better)
    // is identical under all three (monotone transforms of the same player
    // effect); the scale, intervals and baseline follow the choice.
    estMarginal: "Overall",
    estIngame: "In-game",
    estShootout: "Shootout",
    estMarginalTitle: "Added probability vs the average opponent, averaged over the sport-wide shootout share.",
    estIngameTitle: "Standardized to in-game penalties: added probability vs the average opponent if every kick were in-game.",
    estShootoutTitle: "Standardized to shootout kicks: added probability vs the average opponent if every kick were in a shootout.",
    estNoteMarginal: "Scale: overall skill (in-game and shootout kicks weighted by their sport-wide share).",
    estNoteIngame: "Scale: standardized to in-game penalties.",
    estNoteShootout: "Scale: standardized to shootout kicks.",
    labelA: "Player A",
    labelB: "Player B",
    searchPlaceholder: "search…",
    diffSub: "Per-draw difference; the mass right of zero is the probability A is better. Dot = median; bars = 66% and 95% CrI.",
    empty: "Pick two players above to compare them ⚔️",
    errorStatus: "error {status}",

    // the verdict. One sentence, drawn two ways: as HTML on the page and in
    // coloured segments on the exported PNG (both split it on {prob}/{name}).
    verdict: "The model puts a {prob} chance on {name} being {better}.",
    betterTaker: "the better taker",
    betterKeeper: "the better stopper",
    verdictSub: "Estimated from {n} joint posterior draws.",

    // the two player cards (also the PNG's text columns)
    rowTaken: "Taken ({filteredLabel})",
    rowFaced: "Faced ({filteredLabel})",
    rowScored: "Scored",
    rowConceded: "Conceded",
    rowSkill: "Skill vs average (median)",
    rowCi: "95% credible interval",
    rowRank: "Model rank",
    rankValue: "#{rank} of {n}",

    // the two charts
    densTitleTaker: "Estimated penalty-scoring skill",
    densTitleKeeper: "Estimated penalty-stopping skill",
    densSub: "Posterior per player: 66% and 95% credible intervals, dot = median. Dashed line = the average {matchup}.",
    matchupTaker: "taker vs. the average keeper",
    matchupKeeper: "keeper vs. the average taker",
    // the dashed baseline, labelled in the plot: the model's intercept — an
    // average keeper facing an average taker, not the raw league average
    avgLineTaker: "Average taker vs. average keeper · scores {p}",
    avgLineKeeper: "Average keeper vs. average taker · stops {p}",
    diffTitle: "Head to head: {a} − {b}",
    note: "Bayesian crossed random-effects model on {modelDataNote}. P(A better) pairs both players' values within each joint posterior draw.",

    // exported PNG: header + the caption under the charts, assembled from the
    // pieces below (they read as one paragraph; the fit figures only appear
    // when /api/model_info supplies them)
    pngSubtitle: "Head to head · penalty {role} · {n} joint posterior draws",
    pngRoleTakers: "takers",
    pngRoleKeepers: "keepers",
  },

  // ---- goal-probability map ----------------------------------------------
  heatmap: {
    brandSuffix: "goal-probability map",
    subline: "Hover for the goal probability and its 95% credible interval at each spot.",
    // replaces the line above once /api/model_info says how big the fit was
    sublineFitted: "Fitted on {n} on-target penalties · hover for the probability and its 95% credible interval at each spot.",
    footLeft: "Left foot",
    footRight: "Right foot",

    // the plot itself (canvas)
    axisWidth: "width (m)",
    axisHeight: "height (m)",
    colorbar: "Goal prob.",
    tip: "Goal probability <b>{p}</b>",
    tipCi: "95% CI {lo}–{hi}",

    // exported PNG: title, subtitle, and the caption under the plot — which is
    // assembled from these four pieces (the fit size and the blog link only
    // appear when the API supplies them)
    pngTitle: "Where do penalties go in?",
    pngSubtitle: "{foot}-footed takers",
    pngCapIntro: "Post-shot goal probability across the goal for a {foot}-footed taker — the chance an on-target penalty crossing the line at each spot goes in, from a Bayesian surface model",
    pngCapFit: "fitted on {n} on-target penalties",
    pngCapZones: "Dashed lines mark the keeper dive zones.",
  },

  // ---- models -------------------------------------------------------------
  models: {
    h1: "The statistical models",
    intro: "Every skill figure on this site is a posterior estimate from one of the Bayesian models below. This page shows how each skill is distributed across all modelled players, and the full fit summary of each model.",
    footnote: "pp = percentage points added against the average keeper compared to the average player against the average keeper. The modelling is written up in detail on <a href=\"https://maxoosterwegel.com/blog/penalty-kicks-statistical-models\">the blog</a>.",

    // role names on the distribution figure (histogram legend + boxplot strips)
    roleTaker: "Takers",
    roleKeeper: "Goalkeepers",

    // one block per model, in page order. {formula} is the fitted formula,
    // {n} the number of penalties the fit actually saw.
    convTitle: "Penalty skill (conversion)",
    convX: "Added scoring probability vs. average (pp)",
    convBlurb: "A crossed random-effects model of whether a penalty is scored, <code>{formula}</code>, fit on {n} penalties from the historical archive. In our Bayesian hierarchical model, skill estimates are shrunk toward zero when they are sparsely observed (partial pooling). Note that this formula, with its inclusion of the penalty type term (shootout, in-game), is different from <a href=\"https://maxoosterwegel.com/blog/penalty-kicks-statistical-models/\">my initial blog write-up</a>. I decided on this after building the shootout simulator. Now, instead of simply reporting the player's value above/below the average skill level when facing an average goalkeeper/taker, we standardize the skill estimates in the tables to a world where the players have taken/faced {w}% shootout penalties and {ig}% in-game penalties. Before the inclusion of the penalty type term in the model there were just penalties, so no decision on what to standardize to was needed. In jargon, we report the <a href=\"https://www.andrewheiss.com/blog/2022/05/20/marginalia/\">average marginal effect</a> where we calculate the expected probability marginalized over the observed distribution of penalties in our dataset. Differential ability to handle pressure is not taken into account because from a statistical point of view, with only crude data available, these are mostly intangibles. Positive = more goals than the average matchup — good for takers, bad for keepers (the tables flip the keeper sign so higher = better).",

    wwTitle: "Deception / reading skill (wrong way)",
    wwX: "Added wrong-way probability vs. average (pp)",
    wwBlurb: "The same model, but with as outcome whether the keeper moved the wrong way, <code>{formula}</code>, fit on {n} event-data penalties with a recorded dive. Positive = the keeper goes the wrong way more often — good for takers (deception), bad for keepers (the tables flip the keeper sign into reading skill). Note how much wider the taker distribution is than the keeper one. Sending the keeper the wrong way (and with that the infamous stutter run-up?) is really a high variance skill!",

    psxgTitle: "Post-shot goal probability (PSxG)",
    psxgBlurb: "A spline surface over where the ball crosses the goal line, by foot: <code>{formula}</code>, fit on {n} on-target penalties. Explore the surface itself on the <a href=\"heatmap.html\">goal-probability map</a>; the tables' PSxG column is each player's average over it.",

    // Not a fitted model of its own — it reads the posteriors above. Static
    // section in models.html, so no {formula}/{n} to fill.
    jointTitle: "Head to head &amp; shootout simulator",
    jointBlurb: "The <a href=\"compare.html\">head to head</a> and the <a href=\"shootout.html\">shootout simulator</a> both work directly on the models' joint posterior draws. These draws represent the model's uncertainty about its estimates, allow for faithful propagation of parameter uncertainty, and can provide nuance to crude point estimates.",

    // the line under each figure: who sits at the extremes of the distribution
    extremes: "<b>{role}</b> — n = {n} · highest: {high} · lowest: {low}",
    summaryToggle: "Full model summary (brms)",
    error: "Could not load the model summaries.",
  },

  // ---- shootout simulator -------------------------------------------------
  shootout: {
    brandSuffix: "shootout simulator",
    subline: "Build two teams, pick the keepers — the model simulates the shootout from the joint penalty skill posterior.",
    teamA: "Team A",
    teamB: "Team B",
    fillFromTeam: "Fill from a club or national team (optional)",
    fillFromTeamPlaceholderA: "search team… e.g. Argentina, Liverpool",
    fillFromTeamPlaceholderB: "search team… e.g. France, Ajax",
    gkLabelHome: "Goalkeeper (defends against Team B)",
    gkLabelAway: "Goalkeeper (defends against Team A)",
    gkPlaceholder: "search keeper… (blank = average keeper)",
    takersLabel: "Add takers (in kicking order, max 11)",
    takersPlaceholder: "search player…",
    orderBySkill: "↕ Order by skill",
    baseLabelPre: "Takers with no penalty record score",
    baseLabelPost: "vs the average keeper",
    baseHint: "Players in the model score above average because teams try to pick their best takers. A player with no record is probably below that — adjust to taste.",
    firstKick: "First kick",
    firstCoin: "coin toss (50/50)",
    funHint: "what if Messi took all five? — the same player may appear multiple times in a roster",
    funToggle: "Fun mode: repeat takers",
    rules: "Best of 5, alternating; sudden death if level. Unequal rosters are reduced to the smaller size (teams must field equal numbers).",
    scorelinesTitle: "Most likely scorelines",
    scorelinesSub: "Share of simulated shootouts ending at each score (Team A first). Colour = winner.",
    allScorelines: "All scorelines",
    colScore: "Score (A–B)",
    colWinner: "Winner",
    colShare: "Share",
    empty: "Add at least one taker to each team to simulate 🎲",
    errorStatus: "error {status}",
    noTakers: "no eligible takers found for {team}",

    // roster rows: badges, flags and the little button tooltips. All simulator
    // probabilities are the model's SHOOTOUT-standardized ones (the skill
    // pages quote the marginal figure — a different, higher baseline).
    skillTitleTaker: "scores {p} in shootouts vs the average keeper (modelled shootout average: {avg})",
    skillTitleKeeper: "the average modelled taker scores {p} in shootouts against this keeper (vs {avg} against the average keeper)",
    gkAverage: "🧤 average keeper",
    gkRemove: "remove keeper",
    gkNoRecord: "not enough data — treated as an average keeper",
    noRecord: "no record",
    takerNoRecord: "no penalty record in the model — uses the adjustable baseline below",
    vsGk: "{p} vs GK",
    vsGkTitle: "expected scoring chance against {name}",
    unusedTitle: "not used — rosters are reduced to the smaller team's size",
    moveUp: "earlier in the order",
    moveDown: "later in the order",
    remove: "remove",
    orderCustom: "custom order",
    orderBySkillNote: "ordered by skill",
    kicksFirst: "kicks first",

    // the ⓘ next to the no-record baseline, rewritten once the model's own
    // average arrives (so the page can't contradict itself after a refit)
    baseHintLive: "Players in the model average {p} on shootout kicks vs the average keeper because teams try to pick their best takers. A player with no record is probably below that — adjust to taste.",

    // results
    verdict: "{team} wins {p} of simulated shootouts.",
    firstCoinNote: "first kick decided by coin toss",
    firstTeamNote: "{team} kicks first",
    verdictSub: "{reduced}{sd} of shootouts reach sudden death; {first}. {n} shootouts from {draws} joint posterior draws of the takers' and keepers' skill levels.",
    reducedNote: "Rosters reduced to {n} takers each (teams must field equal numbers). ",
    scorelinesSubLive: "Share of simulated shootouts ending at each score ({team}'s goals first). Colour = winner.",
    note: "The posterior draws are over player skill levels: each draw i is one joint sample of every taker's and keeper's skill (plus the model's shootout intercept) from the Bayesian crossed random-effects model, and each kick then scores with p = plogis(b0[i] + b_shootout[i] + taker[i] + keeper[i]) — shootout-standardized, with the opposing keeper taken into account every kick. ▲/▼ compare a player's skill with the modelled average: the average modelled taker scores {p} on shootout kicks vs the average keeper. Takers without a record use the baseline set above (teams try to pick their best takers, so an unmodelled taker is probably below the modelled average).",

    // exported PNG
    pngSubtitle: "Penalty shoot-out simulator",
    pngVs: "{home} vs {away}",
    pngKicksFirst: "  (kicks first)",
    pngGk: "GK: {name}",
    pngGkAverage: "average keeper",
    pngUnused: "  (unused)",
    pngRoster: "{i}. {name}{unused}",
    pngScorelines: "Most likely scorelines",
    capSettings: "Best of 5 + sudden death, {first}{reduced}; takers without a penalty record assumed to score {base} vs the average keeper.",
    capReduced: ", rosters reduced to {n} takers each",
  },

  // ---- match explorer (private) ------------------------------------------
  matches: {
    brandSuffix: "match explorer",
    findMatch: "Find a match",
    findMatchPlaceholder: "e.g. netherlands costa rica 2014…",
    legendGoal: "Goal",
    legendSaved: "Saved",
    legendPost: "Post",
    legendMissed: "Missed",
    empty: "Search a match to replay its penalties 🥅",

    // header
    title: "{home} vs {away}",
    subtitle: "{date} · {competition} ({season})",
    inGoal: "In goal · {keepers}",
    gkOfTeam: "{keeper} ({team})",
    noPlacement: "{n} kick(s) without placement shown in the table only",

    // the kick list
    colTaker: "Taker",
    colTeam: "Team",
    colWhen: "When",
    colFoot: "Foot",
    colKeeper: "Keeper",
    colGkAction: "Keeper action",
    colOutcome: "Outcome",
    colPsxg: "PSxG",
    divedLeft: "dived left",
    divedRight: "dived right",
    stayedCentre: "stayed centre",
    notRecorded: "not recorded",
    rightWayTick: "GK dived the right way",
    offMapTitle: "no placement recorded — not on the shot map",
    listCap: "<span class=\"ok\">✓</span> GK dived the right way · left and right are as drawn on the shot map",
    shootoutKick: "SO {n}",
    minuteKick: "{n}'",

    // the team summary table
    groupAll: "All penalties",
    groupOnTarget: "All penalties on target",
    rowOnTarget: "Shots on target",
    rowOffTarget: "Shots off target",
    rowGoals: "Goals",
    rowPsxg: "Total PSxG",
    rowStopRate: "Stop rate",
    rowRightWay: "GK dived right way",
    rowSaves: "Saves",
    rowSaveRate: "Save rate",
    rowPrevented: "Goals prevented",
    ofTaken: "of {n} taken",
    overTaken: "over {n} taken",
    ofFaced: "of {n} faced",
    keptOfFaced: "{kept}/{faced} faced",
    savedOfFaced: "{saves}/{faced} faced",
    preventedDetail: "{psxg} PSxG − {conceded} conceded",
    avgSuffix: " · avg {p}",
    summaryCap: "Each column is one team, on both sides of the ball: <b>taken</b> rows are its takers, <b>faced</b> rows its keeper against the other team's kicks. Stop rate counts every kick faced, so the keeper is credited with a taker missing the target; save rate counts only the on-target ones. Goals prevented is the PSxG the keeper faced minus what they let in — <span class=\"up\">green</span> saved more than the placements deserved, <span class=\"down\">red</span> fewer. A keeper who stays centre counts as centre.",

    // the goal plot + exported PNG
    axisWidth: "width (m)",
    axisHeight: "height (m)",
    colorbar: "Goal prob.",
    colorbarFoot: "{foot} foot",
    panelLabel: "{foot}-footed takers",
    panelCount: "{label} · {n} {kicks}",
    kickOne: "kick",
    kickMany: "kicks",
    pngSubtitle: "{date} · {competition} ({season}) · {n} {penalties} · ball outline & number: dark = {home}, white = {away}",
    penaltyOne: "penalty",
    penaltyMany: "penalties",
    // the exported picture's caption = the shared caption.* sentences plus this
    capTick: "✓ GK dived the right way (a keeper who stays centre counts as centre)."
  },

  // ---- recent penalties (private) ----------------------------------------
  recent: {
    h1: "Latest penalties in the database",
    filteredHint: "in the filtered dataset the models are fit on?",
    counts: "{srcArchive} {nTm} pens · through {tmLatest} — {srcEvent} {nWs} · through {wsLatest}",
    error: "Could not load /api/recent.",
  },

  // ---- shot map (private) -------------------------------------------------
  shotmap: {
    navTakers: "Takers",
    navFacers: "Facers",
    // link from the rail to the full stat-tile player card (?p= deep link),
    // where the in-game/shootout/overall skill breakdown lives
    moreInfo: "→ full player card",
    moreInfoTitle: "All stat tiles for this player, including the skill breakdown by penalty type (in-game / shootout / overall).",
    viewChart: "Chart",
    viewTable: "Table",
    probabilityGrid: "Probability grid",
    footLeft: "Left foot",
    footRight: "Right foot",
    takersFaced: "Takers faced",
    facedAll: "All",
    facedLeft: "Left",
    facedRight: "Right",
    facedNote: "Filters the penalties shown (and the grid) by the taker's foot.",
    shootoutsOnly: "Shoot-outs only",
    railFootTaker: "Heat = post-shot Goal probability for the selected foot (red&nbsp;low&nbsp;· blue&nbsp;high). Circles are this player's penalties, drawn to scale; diamonds are off-frame outliers pulled to the edge. Click one for the match details.",
    railFootKeeper: "Heat = post-shot Goal probability for the selected taker foot (red&nbsp;low&nbsp;· blue&nbsp;high). Circles are the penalties this goalkeeper faced, drawn to scale; diamonds are off-frame outliers pulled to the edge. Click one for the match details.",
    statEmptyTaker: "Select a player to begin.",
    statEmptyKeeper: "Select a goalkeeper to begin.",
    noDataTaker: "No shot-placement data for this player — showing the probability grid only.",
    noDataKeeper: "No shot-placement data for this goalkeeper — showing the probability grid only.",
    emptyTaker: "Search for a player on the left to see where they put their penalties.",
    emptyKeeper: "Search for a goalkeeper on the left to see the penalties they faced.",
    close: "Close",

    // The shot map is private-only, so it names its sources where the shared
    // card keeps them generic; the tiles it shares with the table pages read
    // their labels from card.* / table.* rather than repeating them here.
    profile: "Player profile",
    marketValue: "Market value",
    marketValuePeak: "{value} (peak {peak})",
    wwTitleTaker: "How much more often than the average taker they send the keeper the wrong way (pp), adjusting for the keepers faced. Fit on the {srcEvent} penalties with a recorded dive.",
    wwTitleKeeper: "How much more often than the average keeper they dive the right way (pp), adjusting for the takers faced. Fit on the {srcEvent} penalties with a recorded dive.",
    splitTaker: "Shot placement ({srcEvent})",
    splitKeeper: "Dive direction ({srcEvent})",
    penListHint: "▸ list",
    passedOverHint: " ▸ passed over",
    outcomes: "Outcomes",
    placementData: "Placement data",
    placementWithData: "{p} with data",

    // outcome names (also the plot's legend)
    outcomeGoal: "Goal",
    outcomeSaved: "Saved",
    outcomePost: "Post",
    outcomeMissed: "Missed",

    // hover tip + the popup on a clicked penalty
    tipBy: "{outcome} · by {name}",
    tipVs: "{outcome} · vs {name}",
    tipHint: "click for details",
    infoCompetition: "Competition",
    infoDate: "Date",
    infoMinute: "Minute",
    infoScore: "Score then",
    infoKeeper: "Keeper",
    personTaker: "Taker",
    personKeeper: "Goalkeeper",
    shootout: "Shoot-out",
    shootoutSeq: "Shoot-out · taker #{n}",
    shootoutScore: "{score} (shoot-out)",
    stayedCentre: "Stayed centre",
    divedDominant: "Dived to dominant side",
    divedNonDominant: "Dived to non-dominant side",
    divedLeft: "Dived left",
    divedRight: "Dived right",

    // the penalty-list modal
    modalEvery: "{name} — every penalty",
    modalEverySub: "{n} on record · source: {source}",
    modalPassedOver: "{name} — passed over",
    modalPassedOverSub: "{n} team {penalties} taken by someone else while on the pitch",
    penaltyOne: "penalty",
    penaltyMany: "penalties",
    colDate: "Date",
    colCompetition: "Competition",
    colMatch: "Match",
    colMin: "Min",
    colOutcome: "Outcome",
    colScore: "Score",
    colTakenBy: "Taken by",
    soSeq: "SO #{n}",
    so: "SO",
    modalEmpty: "No penalties on record.",
    modalNeverPassed: "Never passed over — took every penalty they were on the pitch for.",

    // table view (private: its own column set)
    colStatus: "Status",
    colNationalTeam: "National team",
    titleOpps: "Team penalties while this player was on the pitch ({srcArchive} lineups, filtered competitions). A shoot-out counts once per player — everyone must take before anyone goes twice.",

    // the plot + the exported PNG
    axisWidth: "width (m)",
    axisHeight: "height (m)",
    colorbar: "Goal prob.",
    pngAvg: "avg",
    pngVsGlobal: "{pp} pp vs global avg",
    pngCi: "95% CI {lo} to {hi}",
    pngGlobalSplit: "global {split}",
    pngPanel: "{label} · {n} {shots}",
    shotOne: "shot",
    shotMany: "shots",
    pngStopped: " · stopped {kept}/{n} ({p}%)",
    // the caption under the exported shot map
    // exported table
  },

  // ---- about & methods ----------------------------------------------------
  about: {
    h1: "About",
    figuresFallback: "Penalty statistics and Bayesian model estimates.",
    // the figure line the page assembles from /api/site_meta
    figModelled: "{n} modelled penalties",
    figPlayers: "{takers} takers · {keepers} keepers",
    // n_placed_pen, not the PSxG count: placement is recorded for off-target
    // kicks too, so the PSxG (on-target) set undercounts the coverage
    figPlaced: "{n} with shot placement",
    figUpdated: "updated {date}",

    dataH2: "The data",
    data: "All descriptives and estimates are based on two data sources: a <b>detailed event feed</b> (top European leagues since 2009, including where each on-target penalty crossed the goal line and what the keeper did) and a <b>broad historical archive</b> (hundreds of professional competitions since 1990, with takers, keepers and outcomes). This historical archive may be less reliable in the sense that a higher rate of penalties has not been recorded, e.g. a penalty miss of Pierre van Hooijdonk in the 1996 Old Firm derby is not included. Fixing this is a work in progress.",
    compsSummary: "Competitions covered",
    compsArchive: "Historical archive",
    compsEvent: "Detailed event feed",
    compsColName: "Competition",
    compsColN: "Penalties",
    compsColCovered: "Covered",
    compsError: "Could not load the list.",

    // ---- FAQ. The {placeholders} are model-derived numbers, filled from
    // site_meta's `faq` blob (server.py's _faq_assets) by about.html once the
    // fetch lands — the section can never quote numbers the tables disagree
    // with. Until then (or if the blob is missing) the raw {placeholder}
    // stays visible, per the philosophy at the top of this file.
    faqH2: "FAQ",

    faqQ1: "A player's added value changed, but their penalty record didn't. Why?",
    faqA1: "<p>The models are refit from scratch on every monthly data update. Keep in mind that the skill figures are <i>relative</i> statements, and everything they are relative to can move a little each month: the baseline conversion rate, the estimated spread of skill in the population, and the estimates of every taker you faced and every keeper you beat. New penalties anywhere in the dataset can therefore nudge a player who didn't take any.</p><p>Moreover, the model is fitted by MCMC sampling, which is stochastic: refitting on <i>identical</i> data already gives slightly different numbers. And to keep this site cheap to host, it ships only {nDrawsShipped} of the {nDrawsTotal} posterior draws per player, which introduces additional sampling variability.</p><p>Altogether, movements of a few tenths of a percentage point between updates are expected, and mostly mean nothing — they are within MCMC error.</p>",

    faqQ2: "{topPp} pp for the best (active) taker seems low. The very best takers in the world are… {topConv}% penalty takers?",
    faqA2: "<p>It does seem low — and fortunately, that is not quite what the model believes. It's worth separating two questions that may sound the same but are not: <i>what is the best defensible estimate for this named player? [and then looking at the highest estimate] </i> and <i>how good are the best penalty takers?</i></p><p>The answer to the first question results in a seemingly conservative answer as a penalty carries remarkably little information: at a ~{basePct}% baseline, you need about <b>{nStar} kicks</b> before your own record is weighted as much as what the model knows about penalty takers in general (and at that point your estimate still sits halfway between your record and the average). Only <b>{nOverStar} of the {nTakers} takers</b> in the data clear that bar. That is why every individual estimate is shrunk hard toward the average, why {topName} tops the active list at just <b>{topPp} pp</b> (a ~{topConv}% taker against the average keeper), and why — on this dataset — {ciClause}. {topName}'s interval runs from {topLo} to {topHi} pp: the model can't rule out that they're merely average, and equally can't rule out that they're a ~{topConvHi}% taker.</p><p>The second question gets a much 'bolder' answer as it is about the <i>population</i> and not about any individual player. Namely, the standard deviation of taker's skill implies that the 99.9th-percentile taker truly converts about <b>{p999}%</b> against the average keeper — and at roughly one such taker in {oneIn}, there are probably around <b>{nNinety}</b> takers that good in the data.</p><p>The figure below illustrates the difference between the two questions: the wide curve is the skill the model believes exists in the population, the narrow spike is everything it is willing to pin on individual players after shrinkage.</p>",
    // the two grammatical variants of the credible-interval clause in faqA2;
    // about.html picks by whether the count is zero
    faqCiNone: "<b>not a single taker's 95% credible interval excludes zero</b>",
    faqCiSome: "only <b>{nCiTakers} of the {nTakers} takers'</b> 95% credible intervals exclude zero",
    faqFigAlt: "Two density curves over added scoring probability versus the average keeper. A wide, low curve shows the taker skill the model believes exists in the population, spanning roughly ten percentage points either side of average; a much narrower, taller spike near zero shows the skill actually attributed to individual takers after shrinkage.",
    faqFigCap: "The skill the model believes exists vs. the skill it is willing to attribute to individuals. Regenerated from the live fit on every data update.",

    faqQ3: "Why does the data start in 1992?",
    faqA3: "<p>I have to start somewhere — and it is a bit arbitrary of course — but I went with 1992 because it's about where modern football starts and the game got most of its current shape: the back-pass rule was introduced (1992), the European Cup became the Champions League (1992), and the English top flight relaunched as the Premier League (1992). More pragmatically: before ~1992, penalty data is even less complete. For data completeness' sake I probably should have started in 2003/04 because that's when the data becomes considerably more complete, and it's roughly the first professional season of some players still active today. But I wanted to showcase and appreciate the great historical penalty takers too, and place today's greats in perspective.</p>",

    faqQ4: "Penalty X is missing / player Y's count looks off. Why?",
    faqA4: "<p>In rough order of likelihood:</p><ul><li><b>It happened in the last month.</b> The site updates monthly; the “data through” date at the top of every page tells you where the data ends.</li><li><b>The competition isn't covered.</b> Check the competition list above — I cover senior professional football only: no U19/U21, reserve or amateur matches.</li><li><b>It's an older penalty.</b> Before roughly 2004 the historical archive is less complete: some penalties — especially missed ones — were simply never recorded by the source (the Van Hooijdonk example above). Closing these gaps is a work in progress.</li></ul><p>If none of those apply — or you can tell me exactly what's missing — <a href=\"mailto:max.oosterwegel@gmail.com\">email me</a>. Corrections are very welcome.</p>",

    faqQ5: "Why is the average conversion rate so much higher than in your blog post?",
    faqA5: "<p>I do not have a definite answer for this, but keep in mind that the coverage of the dataset used here is different, in both temporal and geographical terms — and the average conversion rate simply differs over place and time. For example, the contemporary penalty conversion rate is higher in the English Premier League than in other competitions. What could also play a role is that goals are almost always correctly logged, while for missed penalties this is less of a given; that too could move the average by a couple of percentage points.</p>",

    faqQ6: "Why include shootouts in the model? Didn't you say lower shootout conversion was due to worse players stepping up?",
    faqA6: "<p>That earlier statement was based on a very crude analysis. After I had built the shootout simulator and saw the noticeably low conversion rate of shootouts in the 2026 World Cup, I decided to fit this model — and, also to my surprise, the shootout coefficient stayed quite large even with the per-player random intercepts included. So it seems clear that a large part of the lower shootout conversion is <i>not</i> explained by worse players stepping up after all.</p>",

    contactH2: "Contact",
    contact: "Built by <a href=\"https://maxoosterwegel.com\">Max Oosterwegel</a> — <a href=\"mailto:max.oosterwegel@gmail.com\">max.oosterwegel@gmail.com</a>.",
  },
};

// ---------------------------------------------------------------------------
// runtime: T() + the data-copy filler. Nothing below is copy.
// ---------------------------------------------------------------------------
(() => {
  const cfg = window.PENALTY_CONFIG || {};
  const COPY = window.PENALTY_COPY;

  const lookup = (key) =>
    key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), COPY);

  // T("about.data") -> the sentence, {placeholders} filled from vars, then
  // from config. Missing key -> ⟨key⟩; missing placeholder -> left as {name}.
  // Both stay visible on the page: a wrong key should look wrong, not vanish.
  window.T = (key, vars) => {
    const raw = lookup(key);
    if (typeof raw !== "string") {
      console.warn(`copy: no such key "${key}"`);
      return `⟨${key}⟩`;
    }
    return raw.replace(/\{(\w+)\}/g, (m, name) => {
      const v = vars && name in vars ? vars[name] : cfg[name];
      return v == null ? m : String(v);
    });
  };

  // The un-filled template. Canvas code that has to draw one sentence in
  // several fonts/colours (the compare verdict) splits this on its
  // {placeholders} and styles each piece — so the sentence still lives here
  // once, and is not forked into per-fragment keys.
  window.T.raw = (key) => {
    const raw = lookup(key);
    return typeof raw === "string" ? raw : `⟨${key}⟩`;
  };

  // <p data-copy="k">            -> innerHTML
  // <input data-copy-placeholder="k">, <span data-copy-title="k">, … -> attr
  // <a data-brand>                -> the deployment's name, from config.js
  const fill = (root = document) => {
    for (const el of root.querySelectorAll("[data-copy]"))
      el.innerHTML = window.T(el.dataset.copy);
    if (cfg.brand)
      for (const a of root.querySelectorAll(".ph-title a, [data-brand]"))
        a.textContent = cfg.brand;
    for (const el of root.querySelectorAll("*")) {
      for (const name of Object.keys(el.dataset)) {
        if (name === "copy" || !name.startsWith("copy")) continue;
        // copyPlaceholder -> placeholder, copyAriaLabel -> aria-label
        const attr = name.slice(4).replace(/([A-Z])/g, "-$1").toLowerCase()
          .replace(/^-/, "");
        el.setAttribute(attr, window.T(el.dataset[name]));
      }
    }
  };
  window.fillCopy = fill;

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", () => fill());
  else fill();
})();
