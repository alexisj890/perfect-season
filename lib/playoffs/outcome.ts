// How the user's run ended, and the two season honours.
//
// Perfect season (35–0), rules in CLAUDE.md: every league match must be won; a
// two-legged tie the user goes through counts as two wins (even after losing or
// drawing a leg); the final counts however it's won (90 minutes, extra time or
// penalties).
//
// Invincible season (unbeaten): all 35 matches played without losing one. Draws
// are fine. Every match counts on its own, so losing a knockout leg ends it even
// if the user goes through on aggregate. A match decided on penalties counts as
// won or lost by the shootout (as for the Perfect season), so an Invincible
// season always ends with the trophy.

import type { MatchResult, Side } from "@/lib/engine/match";
import { leagueTable, matchesOf, teamRecord, type SeasonState } from "@/lib/season/season";
import { champion, PLAYOFF_TEAMS, playoffMatches, tieWinner, type PlayoffState, type Tie } from "./playoffs";

export type RunOutcome =
  | { kind: "inProgress" }
  | { kind: "relegated"; position: number } // missed the top 8
  | { kind: "eliminated"; round: "QF" | "SF" | "Final" }
  | { kind: "champion"; perfect: boolean; invincible: boolean };

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
  return {
    kind: "champion",
    perfect: perfectSeason(season, playoffs, user).perfect,
    invincible: invincibleSeason(season, playoffs, user).invincible,
  };
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

// One match from the user's side: W, D or L. A shootout counts as won or lost.
export function matchVerdict(result: MatchResult, side: Side): "W" | "D" | "L" {
  const mine = side === "home" ? result.homeGoals : result.awayGoals;
  const theirs = side === "home" ? result.awayGoals : result.homeGoals;
  if (mine !== theirs) return mine > theirs ? "W" : "L";
  if (!result.shootout) return "D";
  const myPens = side === "home" ? result.shootout.home : result.shootout.away;
  const theirPens = side === "home" ? result.shootout.away : result.shootout.home;
  return myPens > theirPens ? "W" : "L";
}

// Every match the user has played so far, in order (league by matchday, then
// knockouts), with its verdict.
function userMatches(season: SeasonState, playoffs: PlayoffState | null, user: number): ("W" | "D" | "L")[] {
  const league = matchesOf(season, user)
    .filter((m) => m.result)
    .sort((a, b) => a.matchday - b.matchday)
    .map((m) => matchVerdict(m.result!, m.home === user ? "home" : "away"));
  const knockout = playoffs
    ? playoffMatches(playoffs)
        .filter((m) => m.result && (m.home === user || m.away === user))
        .map((m) => matchVerdict(m.result!, m.home === user ? "home" : "away"))
    : [];
  return [...league, ...knockout];
}

export interface InvincibleSeasonProgress {
  won: number;
  drawn: number;
  lost: number;
  target: number; // 35
  alive: boolean; // still possible?
  invincible: boolean; // achieved: all 35 played, none lost
}

export function invincibleSeason(season: SeasonState, playoffs: PlayoffState | null, user: number): InvincibleSeasonProgress {
  const verdicts = userMatches(season, playoffs, user);
  const won = verdicts.filter((v) => v === "W").length;
  const drawn = verdicts.filter((v) => v === "D").length;
  const lost = verdicts.filter((v) => v === "L").length;
  const target = matchesOf(season, user).length + 2 + 2 + 1;
  // Not losing isn't enough: the user must also reach the playoffs to play all 35.
  // (Going out of the knockouts always involves a lost match — a defeat or a
  // shootout — so `lost` already covers that.)
  const missedPlayoffs = isSeasonOver(season) && leagueTable(season).findIndex((r) => r.team === user) + 1 > PLAYOFF_TEAMS;
  const alive = lost === 0 && !missedPlayoffs;
  return { won, drawn, lost, target, alive, invincible: alive && verdicts.length === target };
}

// The 35 matches of the season, in order, for the progress dots: 30 league
// matches by matchday, then QF legs, SF legs and the final. Each dot is that
// match's own result.
//   win / draw / loss  played (a shootout counts as won or lost)
//   upcoming           not played yet
//   void               never reached (the run ended before this match)
export type TrackMark = "win" | "draw" | "loss" | "upcoming" | "void";

const MARK: Record<"W" | "D" | "L", TrackMark> = { W: "win", D: "draw", L: "loss" };

export function perfectTrack(season: SeasonState, playoffs: PlayoffState | null, user: number): TrackMark[] {
  const league: TrackMark[] = matchesOf(season, user)
    .sort((a, b) => a.matchday - b.matchday)
    .map((m) => (m.result ? MARK[matchVerdict(m.result, m.home === user ? "home" : "away")] : "upcoming"));

  const outcome = runOutcome(season, playoffs, user);
  const over = outcome.kind === "relegated" || outcome.kind === "eliminated";
  const knockout = (ties: Tie[] | undefined): TrackMark[] => {
    const mine = ties?.find((t) => t.higher === user || t.lower === user);
    if (!mine) return over ? ["void", "void"] : ["upcoming", "upcoming"];
    const leg = (result: MatchResult | null, userHome: boolean): TrackMark =>
      result ? MARK[matchVerdict(result, userHome ? "home" : "away")] : "upcoming";
    // The lower seed hosts leg 1, the higher seed leg 2.
    return [leg(mine.leg1, mine.lower === user), leg(mine.leg2, mine.higher === user)];
  };

  let final: TrackMark = over ? "void" : "upcoming";
  const f = playoffs?.final;
  if (f && (f.home === user || f.away === user)) final = f.result ? MARK[matchVerdict(f.result, f.home === user ? "home" : "away")] : "upcoming";

  return [...league, ...knockout(playoffs?.quarterFinals), ...knockout(playoffs?.semiFinals), final];
}
