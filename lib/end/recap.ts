// Everything the end screen shows about a finished run: how it ended, the
// league finish, the knockout path, the honours, and each player's season
// (ratings over every match the user played, league and knockouts).

import type { GameData } from "@/lib/data/types";
import { matchRatings, seasonPlayerStats, type MatchRatings, type SeasonPlayerStats } from "@/lib/engine/ratings";
import type { Side } from "@/lib/engine/match";
import { invincibleSeason, perfectTrack, runOutcome, type RunOutcome, type TrackMark } from "@/lib/playoffs/outcome";
import { champion, playoffMatches, tieWinner, type PlayoffMatch } from "@/lib/playoffs/playoffs";
import { teamProfiles, userTeam, type RunState } from "@/lib/run";
import { leagueMatchKey, leagueTable, matchesOf } from "@/lib/season/season";
import type { TableRow } from "@/lib/season/standings";

export interface RunRecap {
  outcome: RunOutcome;
  user: number; // the user's team index
  names: string[]; // every team's name, by index
  teamName: string;
  league: TableRow & { position: number; teams: number };
  knockouts: PlayoffMatch[]; // the user's knockout matches, in order
  overall: { won: number; drawn: number; lost: number; played: number };
  marks: TrackMark[];
  championName: string | null; // the playoff winner (when the playoffs were played)
  beatenBy: string | null; // who knocked the user out, if anyone
  squad: SeasonPlayerStats[]; // best average first
  playerOfTheSeason: SeasonPlayerStats | null;
  topScorer: SeasonPlayerStats | null; // most goals; ties go to the better average
}

export function runRecap(run: RunState, data: GameData): RunRecap {
  if (!run.season) throw new Error("The season hasn't started");
  const season = run.season;
  const playoffs = run.playoffs;
  const me = userTeam(run);
  const names = run.draft.teams.map((t) => t.name);
  const profiles = teamProfiles(run, data);

  const table = leagueTable(season);
  const position = table.findIndex((r) => r.team === me) + 1;

  const knockouts = playoffs ? playoffMatches(playoffs).filter((m) => m.result && (m.home === me || m.away === me)) : [];

  // Ratings from every match the user played. The keys match the replay's and
  // the ratings pop-up's, so a player's rating is the same everywhere.
  const rated: { ratings: MatchRatings; side: Side }[] = [
    ...matchesOf(season, me)
      .filter((m) => m.result)
      .map((m) => ({ ratings: matchRatings(m.result!, profiles[m.home], profiles[m.away], leagueMatchKey(m)), side: sideOf(m.home, me) })),
    ...knockouts.map((m) => ({ ratings: matchRatings(m.result!, profiles[m.home!], profiles[m.away!], m.key), side: sideOf(m.home!, me) })),
  ];
  const squad = seasonPlayerStats(profiles[me], rated);
  const topScorer = [...squad].sort((a, b) => b.goals - a.goals || b.averageRating - a.averageRating)[0] ?? null;

  const winner = playoffs ? champion(playoffs) : null;
  let beatenBy: string | null = null;
  if (playoffs) {
    const lostTie = [...playoffs.quarterFinals, ...playoffs.semiFinals].find(
      (t) => (t.higher === me || t.lower === me) && tieWinner(t) !== null && tieWinner(t) !== me,
    );
    const inFinal = playoffs.final && (playoffs.final.home === me || playoffs.final.away === me);
    if (lostTie) beatenBy = names[tieWinner(lostTie)!];
    else if (inFinal && winner !== null && winner !== me) beatenBy = names[winner];
  }

  const unbeaten = invincibleSeason(season, playoffs, me);
  return {
    outcome: runOutcome(season, playoffs, me),
    user: me,
    names,
    teamName: names[me],
    league: { ...table[position - 1], position, teams: table.length },
    knockouts,
    overall: { won: unbeaten.won, drawn: unbeaten.drawn, lost: unbeaten.lost, played: unbeaten.won + unbeaten.drawn + unbeaten.lost },
    marks: perfectTrack(season, playoffs, me),
    championName: winner !== null ? names[winner] : null,
    beatenBy,
    squad,
    playerOfTheSeason: squad[0] ?? null,
    topScorer: topScorer && topScorer.goals > 0 ? topScorer : null,
  };
}

function sideOf(home: number, me: number): Side {
  return home === me ? "home" : "away";
}
