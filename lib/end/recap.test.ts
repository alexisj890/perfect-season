import { describe, expect, it } from "vitest";
import { loadGameData } from "@/lib/data/load";
import { matchRatings } from "@/lib/engine/ratings";
import { autoDraft } from "@/lib/draft/cpu";
import { finishPlayoffs, finishSeason, outcomeOf, startRun, startSeason, teamProfiles, userTeam, type RunState } from "@/lib/run";
import { leagueMatchKey, matchesOf } from "@/lib/season/season";
import { runRecap } from "./recap";

const data = loadGameData();
// The user drafts sharply on easy and badly on hard, so every outcome turns up.
const finished = (seed: number, difficulty: "easy" | "hard"): RunState => {
  const run = startRun(data, { id: "t", createdAt: "", seed, difficulty, userName: "Alexis FC" });
  const drafter =
    difficulty === "easy"
      ? ({ style: "ignoresChemistry", candidates: 2, temperature: 0.5 } as const)
      : ({ style: "starChaser", candidates: 6, temperature: 3 } as const);
  return finishPlayoffs(finishSeason(startSeason({ ...run, draft: autoDraft(run.draft, data, drafter) }), data), data);
};
// The first finished run (by seed) whose outcome matches.
const findRun = (kind: string, difficulty: "easy" | "hard") => {
  for (let seed = 1; seed < 60; seed++) {
    const run = finished(seed, difficulty);
    if (outcomeOf(run).kind === kind) return run;
  }
  throw new Error(`no ${kind} run found`);
};

describe("runRecap", () => {
  it("sums a champion's 35 matches and names them champion", () => {
    const run = findRun("champion", "easy");
    const recap = runRecap(run, data);
    expect(recap.teamName).toBe("Alexis FC");
    expect(recap.overall.played).toBe(35);
    expect(recap.knockouts).toHaveLength(5);
    expect(recap.championName).toBe("Alexis FC");
    expect(recap.beatenBy).toBeNull();
    expect(recap.league.position).toBeLessThanOrEqual(8);
    expect(recap.league.won + recap.league.drawn + recap.league.lost).toBe(30);
  });

  it("names who knocked the user out", () => {
    const recap = runRecap(findRun("eliminated", "hard"), data);
    expect(recap.beatenBy).not.toBeNull();
    expect(recap.beatenBy).not.toBe("Alexis FC");
    expect(recap.championName).not.toBe("Alexis FC");
    expect(recap.marks).toContain("loss");
  });

  it("covers only the league when the user missed the playoffs", () => {
    const recap = runRecap(findRun("relegated", "hard"), data);
    expect(recap.league.position).toBeGreaterThan(8);
    expect(recap.knockouts).toHaveLength(0);
    expect(recap.overall.played).toBe(30);
    expect(recap.beatenBy).toBeNull();
    expect(recap.squad.every((p) => p.apps === 30)).toBe(true);
  });

  it("rates the squad over every match, with the same ratings as the match screens", () => {
    const run = findRun("champion", "easy");
    const recap = runRecap(run, data);
    expect(recap.squad).toHaveLength(11);
    expect(recap.squad.every((p) => p.apps === 35)).toBe(true);
    expect(recap.playerOfTheSeason).toEqual(recap.squad[0]);
    // Goals add up to the team's goals (own goals don't exist in the engine).
    const knockoutGoals = recap.knockouts.reduce((sum, m) => sum + (m.home === userTeam(run) ? m.result!.homeGoals : m.result!.awayGoals), 0);
    expect(recap.squad.reduce((sum, p) => sum + p.goals, 0)).toBe(recap.league.goalsFor + knockoutGoals);
    expect(recap.topScorer!.goals).toBe(Math.max(...recap.squad.map((p) => p.goals)));

    // Matchday 1's rating for the player of the season matches the ratings pop-up.
    const me = userTeam(run);
    const md1 = matchesOf(run.season!, me).find((m) => m.matchday === 1)!;
    const profiles = teamProfiles(run, data);
    const ratings = matchRatings(md1.result!, profiles[md1.home], profiles[md1.away], leagueMatchKey(md1));
    expect(ratings[md1.home === me ? "home" : "away"].some((r) => r.playerId === recap.playerOfTheSeason!.playerId)).toBe(true);
  });
});
