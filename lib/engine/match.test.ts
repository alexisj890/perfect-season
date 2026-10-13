import { describe, expect, it } from "vitest";
import { loadGameData } from "@/lib/data/load";
import { createRng } from "@/lib/rng";
import { ENGINE } from "./config";
import { expectedGoals, simulateMatch, takerOrder, type MatchResult, type MatchType } from "./match";
import { buildTeam, type TeamProfile } from "./team";
import { lineupByRank } from "./testTeams";

const data = loadGameData();
const strong = buildTeam(lineupByRank(data, [1, 2]), data);
const average = buildTeam(lineupByRank(data, [7, 8]), data);
const average2 = buildTeam(lineupByRank(data, [8, 7]), data);

function idsOf(team: TeamProfile) {
  return new Set(team.players.map((p) => p.player.id));
}

// Plays `n` matches, alternating which side is at home, from `team`'s view.
function record(team: TeamProfile, opponent: TeamProfile, n: number, seed = 1) {
  const rng = createRng(seed);
  let wins = 0;
  let draws = 0;
  let goals = 0;
  for (let i = 0; i < n; i++) {
    const atHome = i % 2 === 0;
    const r = atHome ? simulateMatch(team, opponent, rng) : simulateMatch(opponent, team, rng);
    const mine = atHome ? r.homeGoals : r.awayGoals;
    const theirs = atHome ? r.awayGoals : r.homeGoals;
    if (mine > theirs) wins++;
    else if (mine === theirs) draws++;
    goals += mine + theirs;
  }
  return { winRate: wins / n, drawRate: draws / n, goalsPerGame: goals / n };
}

// Many results of one match type between two evenly matched teams.
function many(type: MatchType, n: number, seed = 99): MatchResult[] {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => simulateMatch(average, average2, rng, type));
}

const regulation = (r: MatchResult) => r.goals.filter((g) => g.minute <= 90);
const goalsFor = (goals: MatchResult["goals"], side: string) => goals.filter((g) => g.side === side).length;

describe("simulateMatch: basics", () => {
  it("gives the same result for the same seed", () => {
    expect(simulateMatch(strong, average, createRng(5))).toEqual(
      simulateMatch(strong, average, createRng(5)),
    );
  });

  it("produces a goal timeline that matches the score", () => {
    const rng = createRng(3);
    const homeIds = idsOf(strong);
    const awayIds = idsOf(average);
    for (let i = 0; i < 500; i++) {
      const r = simulateMatch(strong, average, rng);
      expect(r.goals.filter((g) => g.side === "home")).toHaveLength(r.homeGoals);
      expect(r.goals.filter((g) => g.side === "away")).toHaveLength(r.awayGoals);
      expect(r.goals.map((g) => g.minute)).toEqual([...r.goals.map((g) => g.minute)].sort((a, b) => a - b));
      for (const g of r.goals) {
        expect(g.minute).toBeGreaterThanOrEqual(1);
        expect(g.minute).toBeLessThanOrEqual(90);
        const own = g.side === "home" ? homeIds : awayIds;
        expect(own.has(g.scorerId)).toBe(true);
        if (g.assistId) {
          expect(own.has(g.assistId)).toBe(true);
          expect(g.assistId).not.toBe(g.scorerId);
        }
      }
    }
  });

  it("has no winner in a league draw and no extra time or penalties", () => {
    const rng = createRng(4);
    for (let i = 0; i < 500; i++) {
      const r = simulateMatch(average, average2, rng);
      expect(r.extraTime).toBe(false);
      expect(r.shootout).toBeNull();
      expect(r.winner === null).toBe(r.homeGoals === r.awayGoals);
    }
  });

  it("lets forwards score far more than centre-backs", () => {
    const rng = createRng(8);
    const bySlot: Record<string, number> = {};
    const slotOf = new Map(strong.players.map((p) => [p.player.id, p.slot]));
    for (let i = 0; i < 2000; i++) {
      for (const g of simulateMatch(strong, average, rng).goals) {
        if (g.side === "home") {
          const slot = slotOf.get(g.scorerId)!;
          bySlot[slot] = (bySlot[slot] ?? 0) + 1;
        }
      }
    }
    expect(bySlot.ST).toBeGreaterThan(3 * (bySlot.RCB ?? 0));
    expect(bySlot.GK ?? 0).toBeLessThan(bySlot.ST / 50);
  });
});

describe("simulateMatch: venue", () => {
  it("gives the home side a 7% boost and the neutral venue none", () => {
    expect(expectedGoals(average, average, 1.07) / expectedGoals(average, average, 1)).toBeCloseTo(1.07);
  });

  it("makes identical teams win more at home", () => {
    const rng = createRng(12);
    let home = 0;
    let away = 0;
    for (let i = 0; i < 20_000; i++) {
      const r = simulateMatch(average, average, rng);
      if (r.winner === "home") home++;
      if (r.winner === "away") away++;
    }
    expect(home).toBeGreaterThan(away * 1.05);
  });

  it("treats both sides equally at a neutral venue", () => {
    const rng = createRng(13);
    let home = 0;
    let away = 0;
    for (let i = 0; i < 20_000; i++) {
      const r = simulateMatch(average, average, rng, { kind: "final" });
      if (r.winner === "home") home++;
      if (r.winner === "away") away++;
    }
    expect(home / away).toBeGreaterThan(0.94);
    expect(home / away).toBeLessThan(1.06);
  });
});

describe("simulateMatch: which matches get extra time", () => {
  it("never gives league matches or first legs extra time or penalties", () => {
    for (const type of [{ kind: "league" }, { kind: "firstLeg" }] as MatchType[]) {
      const results = many(type, 3000);
      expect(results.some((r) => r.homeGoals === r.awayGoals)).toBe(true); // draws do happen
      for (const r of results) {
        expect(r.extraTime).toBe(false);
        expect(r.shootout).toBeNull();
        expect(r.aggregate).toBeNull();
        expect(r.goals.every((g) => g.minute <= 90)).toBe(true);
      }
    }
  });

  it("gives a second leg extra time only when the aggregate is level after 90", () => {
    const firstLeg = { home: 0, away: 2 }; // this match's away side won the first leg 2–0
    for (const r of many({ kind: "secondLeg", firstLeg }, 3000)) {
      const homeAt90 = goalsFor(regulation(r), "home") + firstLeg.home;
      const awayAt90 = goalsFor(regulation(r), "away") + firstLeg.away;
      // A 2–2 match after 90 is not level on aggregate (2–4), so no extra time.
      expect(r.extraTime).toBe(homeAt90 === awayAt90);
    }
  });

  it("counts extra-time goals toward the aggregate, with penalties only if still level", () => {
    const firstLeg = { home: 1, away: 1 };
    const results = many({ kind: "secondLeg", firstLeg }, 3000);
    expect(results.some((r) => r.extraTime && !r.shootout)).toBe(true); // settled in extra time
    for (const r of results) {
      expect(r.aggregate).toEqual({ home: r.homeGoals + 1, away: r.awayGoals + 1 });
      const levelAfter120 = r.aggregate!.home === r.aggregate!.away;
      expect(r.shootout !== null).toBe(levelAfter120);
      if (!levelAfter120) expect(r.winner).toBe(r.aggregate!.home > r.aggregate!.away ? "home" : "away");
    }
  });

  it("gives the final extra time when level after 90, then penalties when level after 120", () => {
    const results = many({ kind: "final" }, 3000);
    for (const r of results) {
      expect(r.winner).not.toBeNull();
      expect(r.aggregate).toBeNull();
      expect(r.extraTime).toBe(goalsFor(regulation(r), "home") === goalsFor(regulation(r), "away"));
      expect(r.shootout !== null).toBe(r.extraTime && r.homeGoals === r.awayGoals);
      for (const g of r.goals) expect(g.minute).toBeLessThanOrEqual(120);
    }
    expect(results.some((r) => r.shootout)).toBe(true);
  });

  it("scores about a third as many goals in extra time as in 90 minutes", () => {
    const withExtraTime = many({ kind: "final" }, 20_000).filter((r) => r.extraTime);
    const inExtra = withExtraTime.reduce((n, r) => n + r.goals.length - regulation(r).length, 0);
    // Matches that reach extra time were lower-scoring than usual in their first 90
    // minutes, so compare against the overall 90-minute rate instead.
    const all90 = many({ kind: "league" }, 20_000, 98).reduce((n, r) => n + r.goals.length, 0) / 20_000;
    expect(inExtra / withExtraTime.length / all90).toBeCloseTo(1 / 3, 1);
  });
});

describe("simulateMatch: penalty shootouts", () => {
  const shootouts = many({ kind: "final" }, 5000).filter((r) => r.shootout);

  it("lets the most attacking players shoot first and the keeper last", () => {
    const order = takerOrder(strong).map((p) => p.slot);
    expect(order[0]).toBe("ST");
    expect(order.slice(0, 3).sort()).toEqual(["LW", "RW", "ST"]);
    expect(order.at(-1)).toBe("GK");
    // Rating alone doesn't decide it: a centre-back never outranks the striker.
    expect(order.indexOf("RCB")).toBeGreaterThan(order.indexOf("CAM"));
  });

  it("uses that order in real shootouts", () => {
    const homeOrder = takerOrder(average).map((p) => p.player.id);
    for (const r of shootouts) {
      const homeTakers = r.shootout!.kicks.filter((k) => k.side === "home").map((k) => k.takerId);
      expect(homeTakers).toEqual(homeTakers.map((_, i) => homeOrder[i % homeOrder.length]));
    }
  });

  it("keeps a valid score", () => {
    expect(shootouts.length).toBeGreaterThan(0);
    for (const r of shootouts) {
      const s = r.shootout!;
      const scored = (side: string) => s.kicks.filter((k) => k.side === side && k.scored).length;
      expect(s.home).toBe(scored("home"));
      expect(s.away).toBe(scored("away"));
      expect(s.home).not.toBe(s.away);
      expect(r.winner).toBe(s.home > s.away ? "home" : "away");
      const taken = (side: string) => s.kicks.filter((k) => k.side === side).length;
      expect(Math.abs(taken("home") - taken("away"))).toBeLessThanOrEqual(1);
      if (s.kicks.length > 10) expect(taken("home")).toBe(taken("away")); // sudden death is in pairs
    }
  });

  it("ends as soon as it is decided", () => {
    for (const r of shootouts) {
      const kicks = r.shootout!.kicks;
      const score = { home: 0, away: 0 };
      const taken = { home: 0, away: 0 };
      kicks.forEach((kick, i) => {
        taken[kick.side]++;
        if (kick.scored) score[kick.side]++;
        const isLast = i === kicks.length - 1;
        const inFirstFive = taken.home <= 5 && taken.away <= 5;
        const decided = inFirstFive
          ? score.home > score.away + (5 - taken.away) || score.away > score.home + (5 - taken.home)
          : taken.home === taken.away && score.home !== score.away;
        expect(decided, `kick ${i + 1} of ${kicks.length}`).toBe(isLast);
      });
    }
  });
});

describe("chemistry", () => {
  it("gives the edge between evenly matched teams", () => {
    const withChemistry = { ...average, chemistryFactor: 1 + ENGINE.chemistryMaxEffect };
    const without = { ...average, chemistryFactor: 1 };
    const edge = record(withChemistry, average2, 20_000).winRate - record(without, average2, 20_000).winRate;
    expect(edge).toBeGreaterThan(0.045);
    expect(edge).toBeLessThan(0.1);
  });

  it("never lets an average team overtake a clearly better one", () => {
    const good = buildTeam(lineupByRank(data, [4, 5]), data);
    const averageWithMaxChemistry = { ...average, chemistryFactor: 1 + ENGINE.chemistryMaxEffect };
    const goodWithNone = { ...good, chemistryFactor: 1 };
    expect(record(goodWithNone, averageWithMaxChemistry, 20_000).winRate).toBeGreaterThan(0.6);
  });
});

describe("calibration (see lib/engine/config.ts)", () => {
  it("lets a very strong XI beat an average XI about 90% of the time", () => {
    const { winRate } = record(strong, average, 20_000);
    expect(winRate).toBeGreaterThan(0.86);
    expect(winRate).toBeLessThan(0.94);
  });

  it("keeps scorelines realistic between average teams", () => {
    const { goalsPerGame, drawRate } = record(average, average2, 20_000);
    expect(goalsPerGame).toBeGreaterThan(2.5);
    expect(goalsPerGame).toBeLessThan(3.3);
    expect(drawRate).toBeGreaterThan(0.18);
    expect(drawRate).toBeLessThan(0.32);
  });
});
