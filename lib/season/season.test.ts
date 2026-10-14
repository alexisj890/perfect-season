import { describe, expect, it } from "vitest";
import { loadGameData } from "@/lib/data/load";
import { autoDraft } from "@/lib/draft/cpu";
import { createDraft, lineupOf, userTeamIndex } from "@/lib/draft/draft";
import { goalsOf } from "@/lib/engine/match";
import { buildTeam } from "@/lib/engine/team";
import { createFixtures, longestVenueRun } from "./fixtures";
import {
  createSeason,
  isSeasonComplete,
  leagueTable,
  matchdayCount,
  nextMatchday,
  playMatchday,
  playRestOfSeason,
  teamRecord,
} from "./season";
import { standings } from "./standings";

const data = loadGameData();
const draft = autoDraft(createDraft(data, 5), data);
const teams = draft.teams.map((_, i) => buildTeam(lineupOf(draft, i), data));
const user = userTeamIndex(draft);

describe("createFixtures", () => {
  const fixtures = createFixtures(16, 1);

  it("has 30 matchdays of 8 matches", () => {
    expect(fixtures).toHaveLength(240);
    for (let day = 1; day <= 30; day++) expect(fixtures.filter((f) => f.matchday === day)).toHaveLength(8);
  });

  it("has every team play exactly once per matchday", () => {
    for (let day = 1; day <= 30; day++) {
      const playing = fixtures.filter((f) => f.matchday === day).flatMap((f) => [f.home, f.away]);
      expect(playing.sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i));
    }
  });

  it("has every team host every other team exactly once", () => {
    const pairs = new Set(fixtures.map((f) => `${f.home}-${f.away}`));
    expect(pairs.size).toBe(240);
    for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) if (a !== b) expect(pairs.has(`${a}-${b}`)).toBe(true);
  });

  it("mirrors the first half in the second, with venues swapped", () => {
    for (const f of fixtures.filter((f) => f.matchday <= 15)) {
      expect(fixtures).toContainEqual({ matchday: f.matchday + 15, home: f.away, away: f.home });
    }
  });

  it("gives 15 home games each and never three home or away games in a row", () => {
    for (const seed of [1, 2, 3, 4]) {
      const f = createFixtures(16, seed);
      for (let team = 0; team < 16; team++) {
        expect(f.filter((x) => x.home === team)).toHaveLength(15);
        expect(longestVenueRun(f, team)).toBeLessThanOrEqual(2);
      }
    }
  });

  it("changes with the seed and repeats for the same seed", () => {
    expect(createFixtures(16, 1)).toEqual(createFixtures(16, 1));
    expect(createFixtures(16, 1)).not.toEqual(createFixtures(16, 2));
  });

  it("rejects an odd number of teams", () => {
    expect(() => createFixtures(15, 1)).toThrow(/even/);
  });
});

describe("standings", () => {
  it("gives 3 points for a win and 1 for a draw", () => {
    const table = standings(3, [
      { home: 0, away: 1, homeGoals: 2, awayGoals: 0 },
      { home: 1, away: 2, homeGoals: 1, awayGoals: 1 },
    ]);
    const row = (team: number) => table.find((r) => r.team === team)!;
    expect(row(0)).toMatchObject({ played: 1, won: 1, points: 3, goalsFor: 2, goalDifference: 2 });
    expect(row(1)).toMatchObject({ played: 2, drawn: 1, lost: 1, points: 1, goalDifference: -2 });
    expect(row(2)).toMatchObject({ played: 1, drawn: 1, points: 1, goalDifference: 0 });
  });

  it("breaks ties on goal difference, then goals scored", () => {
    const table = standings(4, [
      // Everyone ends on 3 points.
      { home: 0, away: 1, homeGoals: 1, awayGoals: 0 }, // 0: +1, 1 goal
      { home: 1, away: 2, homeGoals: 3, awayGoals: 0 }, // 1: +3 −1 = +2, 3 goals
      { home: 2, away: 3, homeGoals: 4, awayGoals: 2 }, // 2: +2 −3 = −1, 4 goals
      { home: 3, away: 0, homeGoals: 3, awayGoals: 2 }, // 3: −2 +1 = −1, 5 goals; 0: +1 −1 = 0, 3 goals
    ]);
    expect(table.map((r) => r.points)).toEqual([3, 3, 3, 3]);
    expect(table.map((r) => r.team)).toEqual([1, 0, 3, 2]);
  });

  it("then uses head-to-head results between the teams still level", () => {
    // Teams 0 and 1 finish level on points (3), goal difference (0) and goals (2).
    // Team 1 won their meeting, so team 1 goes above team 0 despite the higher index.
    const table = standings(4, [
      { home: 1, away: 0, homeGoals: 1, awayGoals: 0 }, // 1 beats 0
      { home: 0, away: 2, homeGoals: 2, awayGoals: 1 }, // 0 beats 2 → team 0: 3 pts, 2 for, 2 against
      { home: 3, away: 1, homeGoals: 2, awayGoals: 1 }, // 3 beats 1 → team 1: 3 pts, 2 for, 2 against
    ]);
    const row = (team: number) => table.find((r) => r.team === team)!;
    expect([row(0), row(1)].map((r) => [r.points, r.goalDifference, r.goalsFor])).toEqual([
      [3, 0, 2],
      [3, 0, 2],
    ]);
    expect(table.map((r) => r.team).indexOf(1)).toBeLessThan(table.map((r) => r.team).indexOf(0));
  });

  it("uses a head-to-head mini-table when three teams are level", () => {
    // Teams 0, 1 and 2 all finish on 7 points, +2 goal difference, 3 goals.
    //   Between them: 2 beats 0 and 1 (1–0 each); 0 and 1 draw 0–0.
    //   Against the rest: 2 draws 1–1 with 3; 0 beats 3 (2–0) and 4 (1–0);
    //   1 beats 4 (2–0) and 5 (1–0).
    // Head-to-head mini-table: 2 has 6 points, 0 and 1 have 1 each and are level
    // on everything, so 2 goes first and the draft-position fallback puts 0 before 1.
    const table = standings(6, [
      { home: 2, away: 0, homeGoals: 1, awayGoals: 0 },
      { home: 2, away: 1, homeGoals: 1, awayGoals: 0 },
      { home: 0, away: 1, homeGoals: 0, awayGoals: 0 },
      { home: 2, away: 3, homeGoals: 1, awayGoals: 1 },
      { home: 0, away: 3, homeGoals: 2, awayGoals: 0 },
      { home: 0, away: 4, homeGoals: 1, awayGoals: 0 },
      { home: 1, away: 4, homeGoals: 2, awayGoals: 0 },
      { home: 1, away: 5, homeGoals: 1, awayGoals: 0 },
    ]);
    const top = table.slice(0, 3);
    expect(top.map((r) => [r.points, r.goalDifference, r.goalsFor])).toEqual([
      [7, 2, 3],
      [7, 2, 3],
      [7, 2, 3],
    ]);
    expect(top.map((r) => r.team)).toEqual([2, 0, 1]);
  });

  it("falls back to team index when even head-to-head is level", () => {
    expect(standings(3, []).map((r) => r.team)).toEqual([0, 1, 2]);
    const drawnTwice = [
      { home: 0, away: 1, homeGoals: 1, awayGoals: 1 },
      { home: 1, away: 0, homeGoals: 1, awayGoals: 1 },
    ];
    expect(standings(2, drawnTwice).map((r) => r.team)).toEqual([0, 1]);
  });
});

describe("a season", () => {
  const start = createSeason(16, 3, user);
  const done = playRestOfSeason(start, teams);

  it("plays one matchday at a time, in order", () => {
    expect(nextMatchday(start)).toBe(1);
    const afterOne = playMatchday(start, teams);
    expect(nextMatchday(afterOne)).toBe(2);
    expect(afterOne.matches.filter((m) => m.result !== null).every((m) => m.matchday === 1)).toBe(true);
    expect(afterOne.matches.filter((m) => m.result !== null)).toHaveLength(8);
  });

  it("never changes the previous state", () => {
    const snapshot = JSON.stringify(start);
    playMatchday(start, teams);
    expect(JSON.stringify(start)).toBe(snapshot);
  });

  it("finishes after 30 matchdays and then refuses to play on", () => {
    expect(matchdayCount(done)).toBe(30);
    expect(isSeasonComplete(done)).toBe(true);
    expect(nextMatchday(done)).toBeNull();
    expect(() => playMatchday(done, teams)).toThrow(/complete/);
  });

  it("never sends a league match to extra time or penalties", () => {
    for (const m of done.matches) {
      expect(m.result!.extraTime).toBe(false);
      expect(m.result!.shootout).toBeNull();
    }
  });

  it("builds a table where every team played 30 and the points add up", () => {
    const table = leagueTable(done);
    expect(table).toHaveLength(16);
    for (const row of table) {
      expect(row.played).toBe(30);
      expect(row.won + row.drawn + row.lost).toBe(30);
      expect(row.points).toBe(3 * row.won + row.drawn);
    }
    const draws = done.matches.filter((m) => m.result!.homeGoals === m.result!.awayGoals).length;
    const totalPoints = table.reduce((sum, r) => sum + r.points, 0);
    expect(totalPoints).toBe(3 * (240 - draws) + 2 * draws);
    expect(table.reduce((sum, r) => sum + r.goalDifference, 0)).toBe(0);
  });

  it("keeps full detail for the user's matches and only goals for the rest", () => {
    for (const m of done.matches) {
      const r = m.result!;
      expect(goalsOf(r)).toHaveLength(r.homeGoals + r.awayGoals);
      const isUsers = m.home === user || m.away === user;
      if (isUsers) expect(r.events.some((e) => e.type === "corner" || e.outcome !== "goal")).toBe(true);
      else expect(r.events.every((e) => e.type === "shot" && e.outcome === "goal")).toBe(true);
    }
  });

  it("tracks the user's record and whether a perfect season is alive", () => {
    const record = teamRecord(done, user);
    expect(record.played).toBe(30);
    expect(record.won + record.drawn + record.lost).toBe(30);
    expect(record.stillPerfect).toBe(record.won === 30);
    expect(teamRecord(start, user)).toEqual({ played: 0, won: 0, drawn: 0, lost: 0, stillPerfect: true });
  });

  it("survives a JSON round trip mid-season and continues identically", () => {
    let midway = start;
    for (let i = 0; i < 12; i++) midway = playMatchday(midway, teams);
    const restored = JSON.parse(JSON.stringify(midway));
    expect(playRestOfSeason(restored, teams)).toEqual(playRestOfSeason(midway, teams));
  });

  it("repeats exactly for the same seed", () => {
    expect(playRestOfSeason(createSeason(16, 3, user), teams)).toEqual(done);
  });
});
