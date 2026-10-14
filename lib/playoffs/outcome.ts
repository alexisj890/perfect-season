// How the user's run ended, and the perfect-season count.
//
// Perfect-season rules (CLAUDE.md): every league match must be won; a
// two-legged tie the user goes through counts as two wins (even after losing or
// drawing a leg); the final counts however it's won (90 minutes, extra time or
// penalties).

import { leagueTable, matchesOf, teamRecord, type SeasonState } from "@/lib/season/season";
import { champion, PLAYOFF_TEAMS, tieWinner, type PlayoffState, type Tie } from "./playoffs";

export type RunOutcome =
  | { kind: "inProgress" }
  | { kind: "relegated"; position: number } // missed the top 8
  | { kind: "eliminated"; round: "QF" | "SF" | "Final" }
  | { kind: "champion"; perfect: boolean };

export function runOutcome(season: SeasonState, playoffs: PlayoffState | null, user: number): RunOutcome {
  if (season.matches.some((m) => m.result === null)) return { kind: "inProgress" };
  const position = leagueTable(season).findIndex((r) => r.team === user) + 1;
  if (position > PLAYOFF_TEAMS) return { kind: "relegated", position };
  if (!playoffs) return { kind: "inProgress" };

  const lostTie = (ties: Tie[]) =>
    ties.some((t) => (t.higher === user || t.lower === user) && tieWinner(t) !== null && tieWinner(t) !== user);
  if (lostTie(playoffs.quarterFinals)) return { kind: "eliminated", round: "QF" };
  if (lostTie(playoffs.semiFinals)) return { kind: "eliminated", round: "SF" };

  const winner = champion(playoffs);
  if (winner === null) return { kind: "inProgress" };
  if (winner !== user) return { kind: "eliminated", round: "Final" };
  return { kind: "champion", perfect: perfectSeason(season, playoffs, user).perfect };
}

export interface PerfectSeasonProgress {
  wins: number; // how many of the target count so far
  target: number; // 35: 30 league + 2 + 2 + 1
  alive: boolean; // still possible?
  perfect: boolean; // achieved
}

export function perfectSeason(season: SeasonState, playoffs: PlayoffState | null, user: number): PerfectSeasonProgress {
  const record = teamRecord(season, user);
  const target = matchesOf(season, user).length + 2 + 2 + 1;
  let wins = record.won;
  let alive = record.stillPerfect;

  if (playoffs && !playoffs.seeds.includes(user)) alive = false;
  if (playoffs && alive) {
    for (const ties of [playoffs.quarterFinals, playoffs.semiFinals]) {
      const mine = ties.find((t) => t.higher === user || t.lower === user);
      if (!mine) continue;
      const winner = tieWinner(mine);
      if (winner === user) wins += 2;
      else if (winner !== null) alive = false;
    }
    if (playoffs.final?.result) {
      if (champion(playoffs) === user) wins += 1;
      else if (playoffs.final.home === user || playoffs.final.away === user) alive = false;
    }
  }
  if (isSeasonOver(season) && !playoffs) {
    // Season finished but no playoffs yet: only alive if the user qualified.
    const position = leagueTable(season).findIndex((r) => r.team === user) + 1;
    if (position > PLAYOFF_TEAMS) alive = false;
  }
  return { wins, target, alive, perfect: alive && wins === target };
}

function isSeasonOver(season: SeasonState): boolean {
  return season.matches.every((m) => m.result !== null);
}
