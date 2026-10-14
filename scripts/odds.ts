// Monte Carlo odds: how often does a strong, average or weak draft go 35–0?
//
// For each difficulty and each user drafting profile, this runs many complete
// drafts. For every draft it plays the user's 35 matches (30 league, then a
// two-legged quarter-final and semi-final against realistic seeds, then a
// neutral final) over and over, stopping a season at the first dropped result.
//
// A "win" means winning the match itself: more goals (extra time included), or
// level after extra time and then winning the shootout. A two-legged tie counts
// as two wins whenever the user goes through, even after losing or drawing a leg.
//
// Usage: npm run odds -- [--drafts 20] [--seasons 2000] [--difficulty normal]

import { loadGameData } from "@/lib/data/load";
import { DRAFT, type Difficulty } from "@/lib/draft/config";
import { autoDraft, type Drafter } from "@/lib/draft/cpu";
import { createDraft, lineupOf, userTeamIndex } from "@/lib/draft/draft";
import { lineupByRank } from "@/lib/engine/lineups";
import { simulateMatch, type MatchType } from "@/lib/engine/match";
import { buildTeam, type TeamProfile } from "@/lib/engine/team";
import { createRng, type Rng } from "@/lib/rng";

const args = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const DRAFTS = Number(arg("drafts", "20"));
const SEASONS = Number(arg("seasons", "2000"));
const FIXTURE_SIMS = 300;
const difficultyArg = arg("difficulty", "all");
const difficulties = (difficultyArg === "all" ? Object.keys(DRAFT.difficulties) : [difficultyArg]) as Difficulty[];

// How the simulated user drafts.
const PROFILES: Record<string, Drafter> = {
  strong: { style: "ignoresChemistry", candidates: 2, temperature: 0.5 }, // best available, almost no mistakes
  average: { style: "balanced", candidates: 4, temperature: 1.5 }, // chases chemistry, some noise
  weak: { style: "starChaser", candidates: 6, temperature: 3 }, // big names anywhere, sloppy
};

// One thing the user must win on the way to 35–0: a single match, or a whole
// two-legged tie (which covers two of the 35).
type Contest =
  | {
      kind: "match";
      home: TeamProfile;
      away: TeamProfile;
      userSide: "home" | "away";
      type: MatchType;
      bottomQuarterOpponent: boolean;
    }
  | { kind: "tie"; user: TeamProfile; opponent: TeamProfile; bottomQuarterOpponent: false };

const data = loadGameData();
const strength = (t: TeamProfile) => (t.attack + t.defence) / 2;

// The user's 35 matches. Going 30–0 makes the user the 1st seed, so they meet
// the 8th seed, then (most likely) the 4th, then the 2nd in the final.
function userContests(teams: TeamProfile[], userIndex: number): Contest[] {
  const user = teams[userIndex];
  const others = teams.filter((_, i) => i !== userIndex).sort((a, b) => strength(b) - strength(a));
  const bottomQuarter = new Set(others.slice(-4));
  const contests: Contest[] = [];
  for (const opp of others) {
    const weak = bottomQuarter.has(opp);
    const league: MatchType = { kind: "league" };
    contests.push({ kind: "match", home: user, away: opp, userSide: "home", type: league, bottomQuarterOpponent: weak });
    contests.push({ kind: "match", home: opp, away: user, userSide: "away", type: league, bottomQuarterOpponent: weak });
  }
  for (const opp of [others[6], others[2]]) {
    contests.push({ kind: "tie", user, opponent: opp, bottomQuarterOpponent: false });
  }
  const final: MatchType = { kind: "final" };
  contests.push({ kind: "match", home: user, away: others[0], userSide: "home", type: final, bottomQuarterOpponent: false });
  return contests;
}

type Outcome = "win" | "draw" | "loss";

function play(c: Contest, rng: Rng): Outcome {
  if (c.kind === "tie") {
    // The higher seed (the user) is away first, then hosts the second leg.
    const leg1 = simulateMatch(c.opponent, c.user, rng, { kind: "firstLeg" });
    const firstLeg = { home: leg1.awayGoals, away: leg1.homeGoals }; // from the second leg's point of view
    const leg2 = simulateMatch(c.user, c.opponent, rng, { kind: "secondLeg", firstLeg });
    return leg2.winner === "home" ? "win" : "loss";
  }
  const f = c;
  const r = simulateMatch(f.home, f.away, rng, f.type);
  const mine = f.userSide === "home" ? r.homeGoals : r.awayGoals;
  const theirs = f.userSide === "home" ? r.awayGoals : r.homeGoals;
  if (mine !== theirs) return mine > theirs ? "win" : "loss";
  if (!r.shootout) return "draw";
  const userPens = f.userSide === "home" ? r.shootout.home : r.shootout.away;
  const oppPens = f.userSide === "home" ? r.shootout.away : r.shootout.home;
  return userPens > oppPens ? "win" : "loss";
}

function pct(x: number, digits = 1): string {
  if (x > 0 && x < 0.0001) return `${(x * 100).toExponential(1)}%`;
  return `${(x * 100).toFixed(digits)}%`;
}

interface Summary {
  strength: number;
  rank: number;
  win: number;
  draw: number;
  mismatchDraw: number;
  perfectSim: number; // share of simulated seasons that went 35–0
  perfectProduct: number; // product of per-match win rates (smooth estimate for tiny odds)
}

function runScenario(difficulty: Difficulty, profile: Drafter): Summary {
  const totals = { strength: 0, rank: 0, win: 0, draw: 0, mismatchDraw: 0, perfectSim: 0, perfectProduct: 0 };
  for (let d = 0; d < DRAFTS; d++) {
    const seed = 1000 + d;
    const state = autoDraft(createDraft(data, seed, { difficulty }), data, profile);
    const userIndex = userTeamIndex(state);
    const teams = state.teams.map((_, i) => buildTeam(lineupOf(state, i), data));
    const contests = userContests(teams, userIndex);
    const rng = createRng(seed);

    totals.strength += strength(teams[userIndex]);
    totals.rank += 1 + teams.filter((t) => strength(t) > strength(teams[userIndex])).length;

    // Per-contest rates (a two-legged tie counts once here).
    let wins = 0;
    let draws = 0;
    let mismatchDraws = 0;
    let mismatchGames = 0;
    let product = 1;
    for (const c of contests) {
      let w = 0;
      for (let i = 0; i < FIXTURE_SIMS; i++) {
        const o = play(c, rng);
        if (o === "win") w++;
        if (o === "draw") draws++;
        if (c.bottomQuarterOpponent) {
          mismatchGames++;
          if (o === "draw") mismatchDraws++;
        }
      }
      wins += w;
      product *= w / FIXTURE_SIMS;
    }
    const games = contests.length * FIXTURE_SIMS;
    totals.win += wins / games;
    totals.draw += draws / games;
    totals.mismatchDraw += mismatchDraws / mismatchGames;
    totals.perfectProduct += product;

    // Whole seasons, stopping at the first dropped result.
    let perfect = 0;
    for (let s = 0; s < SEASONS; s++) {
      if (contests.every((c) => play(c, rng) === "win")) perfect++;
    }
    totals.perfectSim += perfect / SEASONS;
  }
  return Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v / DRAFTS])) as unknown as Summary;
}

function mismatchCheck() {
  const strong = buildTeam(lineupByRank(data, [1, 2]), data);
  const weak = buildTeam(lineupByRank(data, [13, 14]), data);
  const rng = createRng(1);
  let draws = 0;
  let wins = 0;
  const n = 20_000;
  for (let i = 0; i < n; i++) {
    const r = i % 2 === 0 ? simulateMatch(strong, weak, rng) : simulateMatch(weak, strong, rng);
    if (r.winner === null) draws++;
    else if ((r.winner === "home") === (i % 2 === 0)) wins++;
  }
  return { win: wins / n, draw: draws / n };
}

console.log(`${DRAFTS} drafts per row, ${SEASONS} seasons per draft, ${FIXTURE_SIMS} sims per fixture\n`);
const m = mismatchCheck();
console.log(`Fixed mismatch (2nd–3rd best at every slot vs 14th–15th): win ${pct(m.win)}, draw ${pct(m.draw)}\n`);
console.log(
  "difficulty  draft     strength  rank   win%    draw%   draw% vs bottom 4   35–0 (simulated)   35–0 (product)",
);
for (const difficulty of difficulties) {
  for (const [name, profile] of Object.entries(PROFILES)) {
    const s = runScenario(difficulty, profile);
    console.log(
      `${difficulty.padEnd(11)} ${name.padEnd(9)} ${s.strength.toFixed(1).padStart(8)}  ${s.rank.toFixed(1).padStart(4)}  ` +
        `${pct(s.win).padStart(6)}  ${pct(s.draw).padStart(6)}  ${pct(s.mismatchDraw).padStart(18)}   ` +
        `${pct(s.perfectSim, 2).padStart(16)}   ${pct(s.perfectProduct, 3).padStart(14)}`,
    );
  }
}
