// Plain helpers for the season hub (no React).

import type { TeamProfile } from "@/lib/engine/team";
import { matchesOf, nextMatchday, type LeagueMatch, type SeasonState } from "@/lib/season/season";

export type FormLetter = "W" | "D" | "L";

// A team's result in a played match, from its own point of view.
export function resultFor(match: LeagueMatch, team: number): FormLetter {
  const r = match.result!;
  const mine = match.home === team ? r.homeGoals : r.awayGoals;
  const theirs = match.home === team ? r.awayGoals : r.homeGoals;
  return mine > theirs ? "W" : mine === theirs ? "D" : "L";
}

// Last `count` results, oldest first.
export function formOf(season: SeasonState, team: number, count = 5): FormLetter[] {
  return matchesOf(season, team)
    .filter((m) => m.result)
    .sort((a, b) => a.matchday - b.matchday)
    .slice(-count)
    .map((m) => resultFor(m, team));
}

// The average rating of a team's XI (each player in his slot), as a whole number.
export function xiRating(team: TeamProfile): number {
  return Math.round(team.players.reduce((sum, p) => sum + p.rating, 0) / team.players.length);
}

export function nextMatchFor(season: SeasonState, team: number): LeagueMatch | null {
  const day = nextMatchday(season);
  if (day === null) return null;
  return season.matches.find((m) => m.matchday === day && (m.home === team || m.away === team)) ?? null;
}

export function lastMatchFor(season: SeasonState, team: number): LeagueMatch | null {
  const played = matchesOf(season, team).filter((m) => m.result);
  return played.sort((a, b) => b.matchday - a.matchday)[0] ?? null;
}

// The most recent matchday with results, or 0 before the season starts.
export function latestMatchday(season: SeasonState): number {
  return season.matches.reduce((latest, m) => (m.result ? Math.max(latest, m.matchday) : latest), 0);
}

export function matchesOn(season: SeasonState, matchday: number): LeagueMatch[] {
  return season.matches.filter((m) => m.matchday === matchday);
}

// White letters on dark enough fills (at least 5:1); the letter carries the meaning.
export const FORM_STYLE: Record<FormLetter, string> = {
  W: "bg-emerald-700 text-white",
  D: "bg-slate-600 text-white",
  L: "bg-red-700 text-white",
};
