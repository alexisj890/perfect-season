// One attempt at a perfect season: the draft, the season and the playoffs in a
// single plain, JSON-serializable object. This is what gets saved.
//
// Which screen the run is on (its phase) is worked out from the state rather
// than stored, so it can never disagree with the results.

import type { GameData } from "@/lib/data/types";
import type { MatchResult } from "@/lib/engine/match";
import type { Difficulty } from "@/lib/draft/config";
import { autoDraft, runCpuPicks } from "@/lib/draft/cpu";
import { createDraft, isComplete as isDraftComplete, lineupOf, userTeamIndex, type DraftState } from "@/lib/draft/draft";
import { buildTeam, type TeamProfile } from "@/lib/engine/team";
import { runOutcome, type RunOutcome } from "@/lib/playoffs/outcome";
import {
  createPlayoffs,
  isPlayoffsComplete,
  playNextStep,
  playoffMatches,
  playRestOfPlayoffs,
  type PlayoffState,
} from "@/lib/playoffs/playoffs";
import {
  createSeason,
  isSeasonComplete,
  leagueMatchKey,
  leagueTable,
  playMatchday,
  playRestOfSeason,
  teamRecord,
  type SeasonState,
} from "@/lib/season/season";

export const RUN_VERSION = 1;

export interface RunState {
  version: typeof RUN_VERSION; // bumped when the saved shape changes
  id: string;
  userId: string | null; // null for guests; set once accounts exist
  createdAt: string; // ISO date
  seed: number;
  difficulty: Difficulty;
  draft: DraftState;
  season: SeasonState | null; // created when the draft finishes
  playoffs: PlayoffState | null; // created when the season finishes
  // Set when the player moves on from the finished playoffs to the end screen
  // (optional, so saves from before it existed still load).
  ended?: boolean;
}

export type RunPhase = "draft" | "season" | "playoffs" | "finished";

export interface NewRunOptions {
  id: string;
  createdAt: string;
  seed: number;
  difficulty: Difficulty;
  userName?: string;
}

// Starts a run and lets the computer teams ahead of the user make their picks.
export function startRun(data: GameData, options: NewRunOptions): RunState {
  const draft = createDraft(data, options.seed, { difficulty: options.difficulty, userName: options.userName });
  return {
    version: RUN_VERSION,
    id: options.id,
    userId: null,
    createdAt: options.createdAt,
    seed: options.seed,
    difficulty: options.difficulty,
    draft: runCpuPicks(draft, data),
    season: null,
    playoffs: null,
  };
}

export function userTeam(run: RunState): number {
  return userTeamIndex(run.draft);
}

// Like the draft, a finished season stays in its phase until the player moves
// on (startPlayoffs), so they can see the final table first.
export function runPhase(run: RunState): RunPhase {
  if (!isDraftComplete(run.draft) || !run.season) return "draft";
  if (!isSeasonComplete(run.season) || !run.playoffs) return "season";
  if (runOutcome(run.season, run.playoffs, userTeam(run)).kind === "relegated") return "finished";
  // Like the season, finished playoffs stay on their screen (with the champion)
  // until the player moves on (endRun).
  if (!run.playoffs || !isPlayoffsComplete(run.playoffs) || !run.ended) return "playoffs";
  return "finished";
}

export const PHASE_ROUTES: Record<RunPhase, string> = {
  draft: "/draft",
  season: "/season",
  playoffs: "/playoffs",
  finished: "/end",
};

export function outcomeOf(run: RunState): RunOutcome {
  if (!run.season) return { kind: "inProgress" };
  return runOutcome(run.season, run.playoffs, userTeam(run));
}

// Every team's match profile, built from its drafted lineup.
export function teamProfiles(run: RunState, data: GameData): TeamProfile[] {
  return run.draft.teams.map((_, i) => buildTeam(lineupOf(run.draft, i), data));
}

// ---------------------------------------------------------------------------
// Moving between phases. Each returns a new run and leaves the old one alone.

// Called once the last pick is in.
export function startSeason(run: RunState): RunState {
  if (!isDraftComplete(run.draft)) throw new Error("The draft isn't finished");
  if (run.season) return run;
  return { ...run, season: createSeason(run.draft.teams.length, run.seed + 1, userTeam(run)) };
}

// Called once the last league matchday is played. The top 8 play the playoffs
// even if the user missed out, so the bracket can still be shown.
export function startPlayoffs(run: RunState): RunState {
  if (!run.season || !isSeasonComplete(run.season)) throw new Error("The season isn't finished");
  if (run.playoffs) return run;
  return { ...run, playoffs: createPlayoffs(leagueTable(run.season), run.seed + 2, userTeam(run)) };
}

// Plays the next step of the playoffs (e.g. every QF first leg), or all of them.
export function playPlayoffs(run: RunState, data: GameData, howMuch: "step" | "rest"): RunState {
  if (!run.playoffs) throw new Error("The playoffs haven't started");
  const teams = teamProfiles(run, data);
  const playoffs = howMuch === "step" ? playNextStep(run.playoffs, teams) : playRestOfPlayoffs(run.playoffs, teams);
  return { ...run, playoffs };
}

// Moves on to the end screen. The playoffs are played out first (a knocked-out
// user can skip the rest), so the run always ends with a champion.
export function endRun(run: RunState, data?: GameData): RunState {
  const done = run.playoffs && !isPlayoffsComplete(run.playoffs) && data ? playPlayoffs(run, data, "rest") : run;
  return { ...done, ended: true };
}

// Plays the next league matchday, or every remaining one.
export function playLeague(run: RunState, data: GameData, howMuch: "matchday" | "rest"): RunState {
  if (!run.season) throw new Error("The season hasn't started");
  const teams = teamProfiles(run, data);
  const season = howMuch === "matchday" ? playMatchday(run.season, teams) : playRestOfSeason(run.season, teams);
  return { ...run, season };
}

// ---------------------------------------------------------------------------
// Shortcuts for the dev panel and tests: finish a phase in one go.

export function finishDraft(run: RunState, data: GameData): RunState {
  return startSeason({ ...run, draft: autoDraft(run.draft, data) });
}

export function finishSeason(run: RunState, data: GameData): RunState {
  const started = run.season ? run : startSeason(run);
  return startPlayoffs({ ...started, season: playRestOfSeason(started.season!, teamProfiles(run, data)) });
}

export function finishPlayoffs(run: RunState, data: GameData): RunState {
  const started = run.playoffs ? run : startPlayoffs(run);
  return endRun({ ...started, playoffs: playRestOfPlayoffs(started.playoffs!, teamProfiles(run, data)) });
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: "Easy", normal: "Normal", hard: "Hard" };

// Where a run is, in a few words: "Pick 4 of 176", "Matchday 14 of 30 · 13W 0D 0L", …
export function runSummary(run: RunState): string {
  const phase = runPhase(run);
  if (phase === "draft") {
    const total = run.draft.teams.length * run.draft.rounds;
    if (run.draft.picks.length >= total) return "Draft complete";
    return `Pick ${run.draft.picks.length + 1} of ${total}`;
  }
  if (phase === "season") {
    const s = run.season!;
    if (isSeasonComplete(s)) return "Season complete";
    const played = s.matches.filter((m) => m.result !== null);
    const matchday = played.length === 0 ? 0 : Math.max(...played.map((m) => m.matchday));
    const { won, drawn, lost } = teamRecord(s, userTeam(run));
    return `Matchday ${matchday} of 30 · ${won}W ${drawn}D ${lost}L`;
  }
  if (phase === "playoffs") return "Playoffs";
  const outcome = outcomeOf(run);
  if (outcome.kind === "champion") return outcome.perfect ? "Perfect season!" : "Champions";
  if (outcome.kind === "eliminated") return `Knocked out (${outcome.round})`;
  if (outcome.kind === "relegated") return `Finished ${ordinal(outcome.position)}`;
  return "Finished";
}

// The line under the Continue button: "Easy · Pick 4 of 176".
export function runStatusLine(run: RunState): string {
  return `${DIFFICULTY_LABEL[run.difficulty]} · ${runSummary(run)}`;
}

function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
}

// One of the user's matches, by its id (see leagueMatchKey), with everything a
// replay or ratings view needs. Null if there's no such played match.
export function findUserMatch(run: RunState, data: GameData, key: string) {
  if (!run.season) return null;
  const me = userTeam(run);
  const names = run.draft.teams.map((t) => t.name);
  let found: { title: string; home: number; away: number; result: MatchResult } | null = null;

  const league = run.season.matches.find((m) => leagueMatchKey(m) === key);
  if (league?.result) found = { title: `Matchday ${league.matchday}`, home: league.home, away: league.away, result: league.result };

  const knockout = run.playoffs ? playoffMatches(run.playoffs).find((m) => m.key === key) : undefined;
  if (knockout?.result && knockout.home !== null && knockout.away !== null) {
    // A second leg's title carries the first-leg score, as the teams were then.
    const first = knockout.firstLeg ? ` (1st leg: ${names[knockout.away]} ${knockout.firstLeg.homeGoals}–${knockout.firstLeg.awayGoals} ${names[knockout.home]})` : "";
    found = { title: `${knockout.label}${first}`, home: knockout.home, away: knockout.away, result: knockout.result };
  }

  if (!found || (found.home !== me && found.away !== me)) return null;
  const profiles = teamProfiles(run, data);
  return {
    key,
    title: found.title,
    result: found.result,
    home: profiles[found.home],
    away: profiles[found.away],
    homeName: names[found.home],
    awayName: names[found.away],
    userSide: found.home === me ? ("home" as const) : ("away" as const),
  };
}
