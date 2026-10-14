import { describe, expect, it } from "vitest";
import { loadGameData } from "@/lib/data/load";
import { createRng } from "@/lib/rng";
import { lineupByRank } from "./lineups";
import { goalsOf, simulateMatch } from "./match";
import { matchRatings, RATING, seasonPlayerStats, stableRandom } from "./ratings";
import { buildTeam } from "./team";

const data = loadGameData();
const home = buildTeam(lineupByRank(data, [2, 3]), data);
const away = buildTeam(lineupByRank(data, [8, 9]), data);
const rng = createRng(5);
const games = Array.from({ length: 400 }, (_, i) => {
  const result = simulateMatch(home, away, rng);
  return { result, ratings: matchRatings(result, home, away, `test-${i}`) };
});
const all = games.flatMap((g) => [...g.ratings.home, ...g.ratings.away]);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe("matchRatings", () => {
  it("rates all 22 players between 3 and 10, to one decimal", () => {
    for (const g of games) {
      expect(g.ratings.home).toHaveLength(11);
      expect(g.ratings.away).toHaveLength(11);
    }
    for (const r of all) {
      expect(r.rating).toBeGreaterThanOrEqual(RATING.min);
      expect(r.rating).toBeLessThanOrEqual(RATING.max);
      expect(Math.round(r.rating * 10) / 10).toBe(r.rating);
    }
  });

  it("averages around a typical 6.5–7", () => {
    expect(mean(all.map((r) => r.rating))).toBeGreaterThan(6.2);
    expect(mean(all.map((r) => r.rating))).toBeLessThan(7.2);
  });

  it("is the same every time for the same match", () => {
    const g = games[0];
    expect(matchRatings(g.result, home, away, "test-0")).toEqual(g.ratings);
  });

  it("credits goals and assists to the right players", () => {
    for (const g of games.slice(0, 50)) {
      for (const side of ["home", "away"] as const) {
        const goals = goalsOf(g.result).filter((e) => e.side === side);
        expect(g.ratings[side].reduce((n, r) => n + r.goals, 0)).toBe(goals.length);
        expect(g.ratings[side].reduce((n, r) => n + r.assists, 0)).toBe(goals.filter((e) => e.assistId).length);
      }
    }
  });

  it("rates scorers above players without a goal involvement", () => {
    const scorers = all.filter((r) => r.goals > 0).map((r) => r.rating);
    const quiet = all.filter((r) => r.goals === 0 && r.assists === 0).map((r) => r.rating);
    expect(mean(scorers)).toBeGreaterThan(mean(quiet) + 0.8);
  });

  it("rewards keepers and defenders for a clean sheet", () => {
    const keeper = (g: (typeof games)[number]) => g.ratings.home.find((r) => r.slot === "GK")!.rating;
    const clean = games.filter((g) => g.result.awayGoals === 0).map(keeper);
    const leaky = games.filter((g) => g.result.awayGoals >= 2).map(keeper);
    expect(mean(clean)).toBeGreaterThan(mean(leaky) + 0.5);
  });

  it("names exactly one Man of the Match, with the best rating", () => {
    for (const g of games) {
      const players = [...g.ratings.home, ...g.ratings.away];
      const motm = players.filter((r) => r.motm);
      expect(motm).toHaveLength(1);
      expect(motm[0].playerId).toBe(g.ratings.motm);
      expect(motm[0].rating).toBe(Math.max(...players.map((r) => r.rating)));
    }
  });
});

describe("stableRandom", () => {
  it("is repeatable, in [0, 1), and varies with the key", () => {
    expect(stableRandom("a|b")).toBe(stableRandom("a|b"));
    const xs = Array.from({ length: 1000 }, (_, i) => stableRandom(`k${i}`));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    expect(mean(xs)).toBeCloseTo(0.5, 1);
  });
});

describe("seasonPlayerStats", () => {
  it("adds up appearances, goals, assists and Man of the Match awards", () => {
    const stats = seasonPlayerStats(home, games.map((g) => ({ ratings: g.ratings, side: "home" as const })));
    expect(stats).toHaveLength(11);
    for (const s of stats) expect(s.apps).toBe(400);
    expect(stats.reduce((n, s) => n + s.goals, 0)).toBe(games.reduce((n, g) => n + g.result.homeGoals, 0));
    expect(stats.reduce((n, s) => n + s.motm, 0)).toBe(games.filter((g) => g.ratings.home.some((r) => r.motm)).length);
    expect(stats.map((s) => s.averageRating)).toEqual([...stats.map((s) => s.averageRating)].sort((a, b) => b - a));
  });

  it("is empty before any matches", () => {
    expect(seasonPlayerStats(home, []).every((s) => s.apps === 0 && s.averageRating === 0)).toBe(true);
  });
});
