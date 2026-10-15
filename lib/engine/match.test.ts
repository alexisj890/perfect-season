import { describe, expect, it } from "vitest";
import { loadGameData } from "@/lib/data/load";
import { createRng } from "@/lib/rng";
import { ENGINE } from "./config";
import {
  cornerTaker,
  expectedGoals,
  formatClock,
  goalsOf,
  matchStats,
  setPieceTaker,
  simulateMatch,
  takerOrder,
  type MatchEvent,
  type MatchResult,
  type MatchType,
  type ShotEvent,
} from "./match";
import { buildTeam, type TeamProfile } from "./team";
import { lineupByRank } from "./lineups";

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

// Goals in the first 90 minutes (stoppage time included: 90+4' has minute 90).
const regulation = (r: MatchResult) => goalsOf(r).filter((g) => g.minute <= 90);
const goalsFor = (goals: ShotEvent[], side: string) => goals.filter((g) => g.side === side).length;
const shotsOf = (r: MatchResult) => r.events.filter((e): e is ShotEvent => e.type === "shot");

describe("simulateMatch: basics", () => {
  it("gives the same result for the same seed", () => {
    expect(simulateMatch(strong, average, createRng(5))).toEqual(
      simulateMatch(strong, average, createRng(5)),
    );
  });

  it("produces a timeline that matches the score", () => {
    const rng = createRng(3);
    const ids = { home: idsOf(strong), away: idsOf(average) };
    for (let i = 0; i < 500; i++) {
      const r = simulateMatch(strong, average, rng);
      const goals = goalsOf(r);
      expect(goalsFor(goals, "home")).toBe(r.homeGoals);
      expect(goalsFor(goals, "away")).toBe(r.awayGoals);
      for (const e of r.events) {
        const own = ids[e.side];
        if (e.type === "corner") {
          expect(own.has(e.takerId)).toBe(true);
          continue;
        }
        expect(own.has(e.shooterId)).toBe(true);
        if (e.assistId) {
          expect(e.outcome).toBe("goal");
          expect(own.has(e.assistId)).toBe(true);
          expect(e.assistId).not.toBe(e.shooterId);
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

  it("lets forwards score far more than centre-backs in open play", () => {
    const rng = createRng(8);
    const bySlot: Record<string, number> = {};
    const slotOf = new Map(strong.players.map((p) => [p.player.id, p.slot]));
    for (let i = 0; i < 2000; i++) {
      for (const g of goalsOf(simulateMatch(strong, average, rng))) {
        if (g.side === "home" && g.source === "open play") {
          const slot = slotOf.get(g.shooterId)!;
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
        expect(r.events.every((e) => e.minute <= 90)).toBe(true);
        expect(r.stoppageTime.extraTimeFirstHalf).toBeNull();
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
      for (const e of r.events) expect(e.minute).toBeLessThanOrEqual(120);
    }
    expect(results.some((r) => r.shootout)).toBe(true);
  });

  it("scores about a third as many goals in extra time as in 90 minutes", () => {
    const withExtraTime = many({ kind: "final" }, 20_000).filter((r) => r.extraTime);
    const inExtra = withExtraTime.reduce((n, r) => n + goalsOf(r).length - regulation(r).length, 0);
    // Matches that reach extra time were lower-scoring than usual in their first 90
    // minutes, so compare against the overall 90-minute rate instead.
    const all90 = many({ kind: "league" }, 20_000, 98).reduce((n, r) => n + goalsOf(r).length, 0) / 20_000;
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
      const scored = (side: string) => s.kicks.filter((k) => k.side === side && k.outcome === "goal").length;
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
        if (kick.outcome === "goal") score[kick.side]++;
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

describe("simulateMatch: stoppage time", () => {
  const results = many({ kind: "final" }, 3000, 31);
  const { firstHalf, secondHalf, extraTimeHalf } = ENGINE.stoppageTime;

  it("adds stoppage time to each half within the configured range", () => {
    for (const r of results) {
      const st = r.stoppageTime;
      expect(st.firstHalf).toBeGreaterThanOrEqual(firstHalf[0]);
      expect(st.firstHalf).toBeLessThanOrEqual(firstHalf[1]);
      expect(st.secondHalf).toBeGreaterThanOrEqual(secondHalf[0]);
      expect(st.secondHalf).toBeLessThanOrEqual(secondHalf[1]);
      expect(st.extraTimeFirstHalf !== null).toBe(r.extraTime);
      if (r.extraTime) expect(st.extraTimeSecondHalf!).toBeLessThanOrEqual(extraTimeHalf[1]);
    }
  });

  it("only puts events in stoppage time at the end of a half, and never beyond it", () => {
    const ends: Record<number, (r: MatchResult) => number | null> = {
      45: (r) => r.stoppageTime.firstHalf,
      90: (r) => r.stoppageTime.secondHalf,
      105: (r) => r.stoppageTime.extraTimeFirstHalf,
      120: (r) => r.stoppageTime.extraTimeSecondHalf,
    };
    let stoppageGoals = 0;
    for (const r of results) {
      for (const e of r.events) {
        if (e.addedTime === 0) continue;
        expect(Object.keys(ends).map(Number)).toContain(e.minute);
        expect(e.addedTime).toBeLessThanOrEqual(ends[e.minute](r)!);
        if (e.type === "shot" && e.outcome === "goal") stoppageGoals++;
      }
    }
    expect(stoppageGoals).toBeGreaterThan(0);
  });

  it("keeps events in time order, with 45+3' before 46'", () => {
    const order = (e: MatchEvent) => e.minute + e.addedTime / 100;
    for (const r of results) {
      const times = r.events.map(order);
      expect(times).toEqual([...times].sort((a, b) => a - b));
    }
  });

  it("formats the clock like a scoreboard", () => {
    expect(formatClock({ minute: 23, addedTime: 0 })).toBe("23'");
    expect(formatClock({ minute: 90, addedTime: 3 })).toBe("90+3'");
  });
});

describe("simulateMatch: shots, corners and set pieces", () => {
  const rng = createRng(17);
  // Identical teams, so the numbers reflect a typical even match.
  const results = Array.from({ length: 4000 }, () => simulateMatch(average, average, rng));
  const shots = results.flatMap(shotsOf).filter((s) => s.side === "home");
  const perMatch = (n: number) => n / results.length;

  it("produces realistic match stats", () => {
    const stats = results.map((r) => matchStats(r).home);
    const avg = (pick: (s: (typeof stats)[number]) => number) => stats.reduce((n, s) => n + pick(s), 0) / stats.length;
    expect(avg((s) => s.shots)).toBeGreaterThan(9);
    expect(avg((s) => s.shots)).toBeLessThan(16);
    expect(avg((s) => s.shotsOnTarget) / avg((s) => s.shots)).toBeGreaterThan(0.3);
    expect(avg((s) => s.shotsOnTarget) / avg((s) => s.shots)).toBeLessThan(0.5);
    expect(avg((s) => s.corners)).toBeGreaterThan(3);
    expect(avg((s) => s.corners)).toBeLessThan(7);
    expect(avg((s) => s.woodwork)).toBeLessThan(1);
    expect(avg((s) => s.goals)).toBeCloseTo(avg((s) => s.shots) * 0.1, 0);
  });

  it("keeps a dominant side's shot count realistic", () => {
    const weak = buildTeam(lineupByRank(data, [14, 15]), data);
    const r2 = createRng(23);
    const shots = Array.from({ length: 3000 }, () => matchStats(simulateMatch(strong, weak, r2)).home.shots);
    const mean = shots.reduce((a, b) => a + b, 0) / shots.length;
    expect(mean).toBeGreaterThan(16); // more shots than an average side…
    expect(mean).toBeLessThan(28); // …but not the 40 a straight-line rule gave
  });

  it("has every outcome and source happen", () => {
    for (const outcome of ["goal", "saved", "post", "wide"]) expect(shots.some((s) => s.outcome === outcome)).toBe(true);
    for (const source of ["open play", "corner", "free kick", "penalty"]) {
      expect(shots.some((s) => s.source === source && s.outcome === "goal"), source).toBe(true);
    }
    const penalties = shots.filter((s) => s.source === "penalty");
    expect(perMatch(penalties.length)).toBeGreaterThan(0.05);
    expect(perMatch(penalties.length)).toBeLessThan(0.3);
    // About 0.81 over 40,000 matches for these sides (0.78 base, nudged by the
    // takers' skill). This sample holds only a few hundred penalties, so allow for noise.
    const conversion = penalties.filter((s) => s.outcome === "goal").length / penalties.length;
    expect(conversion).toBeGreaterThan(0.72);
    expect(conversion).toBeLessThan(0.9);
  });

  it("gives penalties and direct free kicks to the most attacking player, unassisted", () => {
    const taker = setPieceTaker(average).player.id;
    expect(taker).toBe(takerOrder(average)[0].player.id);
    for (const s of shots.filter((s) => s.source === "penalty" || s.source === "free kick")) {
      expect(s.shooterId).toBe(taker);
      expect(s.assistId).toBeNull();
    }
  });

  it("credits the corner taker with corner assists, and every corner shot follows a corner", () => {
    const taker = cornerTaker(average).player.id;
    const takerSlot = average.players.find((p) => p.player.id === taker)!.slot;
    expect(["CM", "CAM", "RW", "LW"]).toContain(takerSlot);
    for (const r of results) {
      r.events.forEach((e, i) => {
        if (e.type !== "shot" || e.side !== "home" || e.source !== "corner") return;
        const before = r.events[i - 1];
        expect(before).toMatchObject({ type: "corner", side: "home", minute: e.minute, addedTime: e.addedTime, takerId: taker });
        expect(e.shooterId).not.toBe(taker);
        if (e.outcome === "goal") expect(e.assistId).toBe(taker);
      });
    }
  });

  it("lets centre-backs score headers from corners but keepers never", () => {
    const slotOf = new Map(average.players.map((p) => [p.player.id, p.slot]));
    const headerScorers = shots.filter((s) => s.source === "corner").map((s) => slotOf.get(s.shooterId));
    expect(headerScorers).toContain("RCB");
    expect(headerScorers).not.toContain("GK");
  });

  it("only assists goals", () => {
    for (const s of shots) if (s.outcome !== "goal") expect(s.assistId).toBeNull();
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
  const good = buildTeam(lineupByRank(data, [4, 5]), data);
  const weak = buildTeam(lineupByRank(data, [13, 14]), data);

  it("lets a good XI beat an average XI most of the time", () => {
    const { winRate } = record(good, average, 20_000);
    expect(winRate).toBeGreaterThan(0.82);
    expect(winRate).toBeLessThan(0.9);
  });

  it("keeps scorelines realistic between evenly matched teams", () => {
    const { goalsPerGame, drawRate } = record(average, average2, 20_000);
    expect(goalsPerGame).toBeGreaterThan(2.5);
    expect(goalsPerGame).toBeLessThan(3.3);
    expect(drawRate).toBeGreaterThan(0.18);
    expect(drawRate).toBeLessThan(0.32);
  });

  it("makes mismatches decisive, with few draws but no absurd scorelines", () => {
    const { winRate, drawRate, goalsPerGame } = record(average, weak, 20_000);
    expect(winRate).toBeGreaterThan(0.95);
    expect(drawRate).toBeLessThan(0.04);
    expect(goalsPerGame).toBeLessThan(5);
    expect(record(strong, weak, 20_000).goalsPerGame).toBeLessThan(5);
  });
});
