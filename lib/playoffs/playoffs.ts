// The Champions League-style knockout. Pure functions over a plain,
// JSON-serializable PlayoffState, played one step at a time:
//   QF leg 1 → QF leg 2 → SF leg 1 → SF leg 2 → Final
//
// Fixed bracket: quarter-finals 1v8, 4v5, 2v7, 3v6; the 1v8 winner meets the
// 4v5 winner and the 2v7 winner meets the 3v6 winner, so seeds 1 and 2 can only
// meet in the final. In two-legged ties the lower seed hosts the first leg and
// the higher seed hosts the second. The final is at a neutral venue.

import { keepGoalsOnly, simulateMatch, type MatchResult, type MatchType } from "@/lib/engine/match";
import type { TeamProfile } from "@/lib/engine/team";
import { createRng } from "@/lib/rng";
import type { TableRow } from "@/lib/season/standings";

export const PLAYOFF_TEAMS = 8;

export type Round = "QF" | "SF";

export interface Tie {
  round: Round;
  higher: number; // better-seeded team (team index); hosts the second leg
  lower: number; // hosts the first leg
  leg1: MatchResult | null; // home side = lower seed
  leg2: MatchResult | null; // home side = higher seed; its `winner` decides the tie
}

export interface FinalMatch {
  home: number; // the better seed is listed first; the venue is neutral
  away: number;
  result: MatchResult | null;
}

export interface PlayoffState {
  seeds: number[]; // seeds[0] is the 1st seed's team index
  userTeam: number | null; // the user's matches keep every event; others keep only goals
  quarterFinals: Tie[]; // in bracket order: 1v8, 4v5, 2v7, 3v6
  semiFinals: Tie[]; // empty until the quarter-finals are done
  final: FinalMatch | null; // null until the semi-finals are done
  rngState: number;
}

export type PlayoffStep = "QF leg 1" | "QF leg 2" | "SF leg 1" | "SF leg 2" | "Final";

// ---------------------------------------------------------------------------
// Setting up

export function createPlayoffs(table: TableRow[], seed: number, userTeam: number | null = null): PlayoffState {
  if (table.length < PLAYOFF_TEAMS) throw new Error(`Need at least ${PLAYOFF_TEAMS} teams for the playoffs`);
  const seeds = table.slice(0, PLAYOFF_TEAMS).map((r) => r.team);
  const bySeed = (n: number) => seeds[n - 1];
  const tie = (higher: number, lower: number): Tie => ({
    round: "QF",
    higher: bySeed(higher),
    lower: bySeed(lower),
    leg1: null,
    leg2: null,
  });
  return {
    seeds,
    userTeam,
    quarterFinals: [tie(1, 8), tie(4, 5), tie(2, 7), tie(3, 6)],
    semiFinals: [],
    final: null,
    rngState: createRng(seed).state(),
  };
}

// ---------------------------------------------------------------------------
// Reading the state

export function seedOf(state: PlayoffState, team: number): number | null {
  const i = state.seeds.indexOf(team);
  return i < 0 ? null : i + 1;
}

export function tieWinner(tie: Tie): number | null {
  if (!tie.leg2) return null;
  return tie.leg2.winner === "home" ? tie.higher : tie.lower;
}

// Both legs combined, from the higher seed's point of view.
export function tieAggregate(tie: Tie): { higher: number; lower: number } | null {
  if (!tie.leg1 || !tie.leg2) return null;
  return {
    higher: tie.leg1.awayGoals + tie.leg2.homeGoals,
    lower: tie.leg1.homeGoals + tie.leg2.awayGoals,
  };
}

export function champion(state: PlayoffState): number | null {
  const f = state.final;
  if (!f?.result) return null;
  return f.result.winner === "home" ? f.home : f.away;
}

export function nextStep(state: PlayoffState): PlayoffStep | null {
  if (state.quarterFinals.some((t) => !t.leg1)) return "QF leg 1";
  if (state.quarterFinals.some((t) => !t.leg2)) return "QF leg 2";
  if (state.semiFinals.some((t) => !t.leg1)) return "SF leg 1";
  if (state.semiFinals.some((t) => !t.leg2)) return "SF leg 2";
  if (state.final && !state.final.result) return "Final";
  return null;
}

export function isPlayoffsComplete(state: PlayoffState): boolean {
  return nextStep(state) === null;
}

// ---------------------------------------------------------------------------
// Playing

export function playNextStep(state: PlayoffState, teams: TeamProfile[]): PlayoffState {
  const step = nextStep(state);
  if (!step) throw new Error("The playoffs are already complete");
  const rng = createRng(state.rngState);

  const play = (home: number, away: number, type: MatchType): MatchResult => {
    const result = simulateMatch(teams[home], teams[away], rng, type);
    const involvesUser = home === state.userTeam || away === state.userTeam;
    return involvesUser ? result : keepGoalsOnly(result);
  };
  const playLeg1 = (t: Tie): Tie => ({ ...t, leg1: play(t.lower, t.higher, { kind: "firstLeg" }) });
  const playLeg2 = (t: Tie): Tie => {
    // The second leg's home side is the higher seed, who was away in the first leg.
    const firstLeg = { home: t.leg1!.awayGoals, away: t.leg1!.homeGoals };
    return { ...t, leg2: play(t.higher, t.lower, { kind: "secondLeg", firstLeg }) };
  };

  let next: PlayoffState;
  switch (step) {
    case "QF leg 1":
      next = { ...state, quarterFinals: state.quarterFinals.map(playLeg1) };
      break;
    case "QF leg 2": {
      const quarterFinals = state.quarterFinals.map(playLeg2);
      next = { ...state, quarterFinals, semiFinals: pairWinners(state, quarterFinals, "SF") };
      break;
    }
    case "SF leg 1":
      next = { ...state, semiFinals: state.semiFinals.map(playLeg1) };
      break;
    case "SF leg 2": {
      const semiFinals = state.semiFinals.map(playLeg2);
      const [a, b] = semiFinals.map((t) => tieWinner(t)!);
      const [home, away] = bySeedOrder(state, a, b);
      next = { ...state, semiFinals, final: { home, away, result: null } };
      break;
    }
    case "Final": {
      const f = state.final!;
      next = { ...state, final: { ...f, result: play(f.home, f.away, { kind: "final" }) } };
      break;
    }
  }
  return { ...next, rngState: rng.state() };
}

export function playRestOfPlayoffs(state: PlayoffState, teams: TeamProfile[]): PlayoffState {
  let next = state;
  while (!isPlayoffsComplete(next)) next = playNextStep(next, teams);
  return next;
}

// Neighbouring ties feed the next round: winners of ties 0 and 1 meet, then 2 and 3.
function pairWinners(state: PlayoffState, ties: Tie[], round: Round): Tie[] {
  const pairs: Tie[] = [];
  for (let i = 0; i < ties.length; i += 2) {
    const [higher, lower] = bySeedOrder(state, tieWinner(ties[i])!, tieWinner(ties[i + 1])!);
    pairs.push({ round, higher, lower, leg1: null, leg2: null });
  }
  return pairs;
}

function bySeedOrder(state: PlayoffState, a: number, b: number): [number, number] {
  return seedOf(state, a)! < seedOf(state, b)! ? [a, b] : [b, a];
}

// ---------------------------------------------------------------------------
// Every knockout match as a flat list, for the bracket, the "up next" panel
// and replays. Keys look like "qf-1-1" (quarter-final tie 1, first leg),
// "sf-2-2" or "final".

export interface PlayoffMatch {
  key: string;
  step: PlayoffStep; // which step of the playoffs it's played in
  label: string; // "Quarter-final, 1st leg"
  home: number | null; // team index; null while not yet known
  away: number | null;
  result: MatchResult | null;
  neutral: boolean;
  firstLeg: MatchResult | null; // for a second leg: how the first leg went (home/away as played then)
}

const ROUND_NAME: Record<Round, string> = { QF: "Quarter-final", SF: "Semi-final" };

export function playoffMatches(state: PlayoffState): PlayoffMatch[] {
  const matches: PlayoffMatch[] = [];
  const legs = (ties: Tie[], round: Round) =>
    ties.forEach((tie, i) => {
      const prefix = `${round.toLowerCase()}-${i + 1}`;
      matches.push({
        key: `${prefix}-1`,
        step: `${round} leg 1` as PlayoffStep,
        label: `${ROUND_NAME[round]}, 1st leg`,
        home: tie.lower,
        away: tie.higher,
        result: tie.leg1,
        neutral: false,
        firstLeg: null,
      });
      matches.push({
        key: `${prefix}-2`,
        step: `${round} leg 2` as PlayoffStep,
        label: `${ROUND_NAME[round]}, 2nd leg`,
        home: tie.higher,
        away: tie.lower,
        result: tie.leg2,
        neutral: false,
        firstLeg: tie.leg1,
      });
    });
  legs(state.quarterFinals, "QF");
  legs(state.semiFinals, "SF");
  const f = state.final;
  matches.push({
    key: "final",
    step: "Final",
    label: "Final",
    home: f?.home ?? null,
    away: f?.away ?? null,
    result: f?.result ?? null,
    neutral: true,
    firstLeg: null,
  });
  return matches;
}

// The user's match in the next step, if they're still in it.
export function nextUserMatch(state: PlayoffState, team: number): PlayoffMatch | null {
  const step = nextStep(state);
  if (!step) return null;
  return playoffMatches(state).find((m) => m.step === step && (m.home === team || m.away === team)) ?? null;
}
