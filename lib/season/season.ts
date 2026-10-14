// The regular season. Pure functions over a plain, JSON-serializable
// SeasonState: playing a matchday returns a new state with that matchday's
// results stored, so a season can be saved after any matchday and resumed.
// Results are stored, never re-simulated from a seed (see CLAUDE.md).

import { goalsOf, keepGoalsOnly, simulateMatch, type MatchResult } from "@/lib/engine/match";
import type { TeamProfile } from "@/lib/engine/team";
import { createRng } from "@/lib/rng";
import { createFixtures, type Fixture } from "./fixtures";
import { standings, type PlayedMatch, type TableRow } from "./standings";

export interface LeagueMatch extends Fixture {
  result: MatchResult | null; // null until played
}

export interface SeasonState {
  teamCount: number;
  // The user's matches keep every event (for the match replay). Other matches
  // keep only their goals, which keeps a saved season small.
  userTeam: number | null;
  matches: LeagueMatch[]; // every fixture, in matchday order
  rngState: number;
}

export function createSeason(teamCount: number, seed: number, userTeam: number | null = null): SeasonState {
  const rng = createRng(seed);
  const fixtures = createFixtures(teamCount, Math.floor(rng.next() * 2 ** 32));
  return {
    teamCount,
    userTeam,
    matches: fixtures.map((f) => ({ ...f, result: null })),
    rngState: rng.state(),
  };
}

export function matchdayCount(state: SeasonState): number {
  return Math.max(...state.matches.map((m) => m.matchday));
}

// The next matchday to play, or null once the season is over.
export function nextMatchday(state: SeasonState): number | null {
  const unplayed = state.matches.find((m) => m.result === null);
  return unplayed ? unplayed.matchday : null;
}

export function isSeasonComplete(state: SeasonState): boolean {
  return nextMatchday(state) === null;
}

// Plays every match of the next matchday. `teams[i]` is team i's profile
// (built from its drafted lineup).
export function playMatchday(state: SeasonState, teams: TeamProfile[]): SeasonState {
  const matchday = nextMatchday(state);
  if (matchday === null) throw new Error("The season is already complete");
  if (teams.length !== state.teamCount) throw new Error(`Expected ${state.teamCount} teams, got ${teams.length}`);
  const rng = createRng(state.rngState);
  const matches = state.matches.map((m) => {
    if (m.matchday !== matchday) return m;
    const result = simulateMatch(teams[m.home], teams[m.away], rng);
    const involvesUser = m.home === state.userTeam || m.away === state.userTeam;
    return { ...m, result: involvesUser ? result : keepGoalsOnly(result) };
  });
  return { ...state, matches, rngState: rng.state() };
}

export function playRestOfSeason(state: SeasonState, teams: TeamProfile[]): SeasonState {
  let next = state;
  while (!isSeasonComplete(next)) next = playMatchday(next, teams);
  return next;
}

export function leagueTable(state: SeasonState): TableRow[] {
  const played: PlayedMatch[] = state.matches
    .filter((m) => m.result !== null)
    .map((m) => ({ home: m.home, away: m.away, homeGoals: m.result!.homeGoals, awayGoals: m.result!.awayGoals }));
  return standings(state.teamCount, played);
}

export function matchesOf(state: SeasonState, team: number): LeagueMatch[] {
  return state.matches.filter((m) => m.home === team || m.away === team);
}

// A team's record so far, and whether a perfect season is still alive.
export function teamRecord(state: SeasonState, team: number) {
  const played = matchesOf(state, team).filter((m) => m.result !== null);
  let won = 0;
  let drawn = 0;
  let lost = 0;
  for (const m of played) {
    const mine = m.home === team ? m.result!.homeGoals : m.result!.awayGoals;
    const theirs = m.home === team ? m.result!.awayGoals : m.result!.homeGoals;
    if (mine > theirs) won++;
    else if (mine === theirs) drawn++;
    else lost++;
  }
  return { played: played.length, won, drawn, lost, stillPerfect: drawn === 0 && lost === 0 };
}

export interface ScorerRow {
  playerId: string;
  team: number;
  goals: number;
  assists: number;
}

// Goals and assists across all played matches, top scorers first
// (ties broken by assists).
export function topScorers(state: SeasonState): ScorerRow[] {
  const rows = new Map<string, ScorerRow>();
  const row = (playerId: string, team: number) => {
    let r = rows.get(playerId);
    if (!r) rows.set(playerId, (r = { playerId, team, goals: 0, assists: 0 }));
    return r;
  };
  for (const m of state.matches) {
    for (const g of m.result ? goalsOf(m.result) : []) {
      const team = g.side === "home" ? m.home : m.away;
      row(g.shooterId, team).goals++;
      if (g.assistId) row(g.assistId, team).assists++;
    }
  }
  return [...rows.values()].sort((a, b) => b.goals - a.goals || b.assists - a.assists);
}
