import { describe, expect, it } from "vitest";
import { loadGameData } from "@/lib/data/load";
import { autoDraft } from "@/lib/draft/cpu";
import { createDraft, lineupOf, userTeamIndex } from "@/lib/draft/draft";
import type { MatchResult } from "@/lib/engine/match";
import { buildTeam } from "@/lib/engine/team";
import { createSeason, leagueTable, playRestOfSeason, type SeasonState } from "@/lib/season/season";
import { perfectSeason, perfectTrack, runOutcome } from "./outcome";
import {
  champion,
  createPlayoffs,
  isPlayoffsComplete,
  nextStep,
  playNextStep,
  playRestOfPlayoffs,
  seedOf,
  tieAggregate,
  tieWinner,
  type PlayoffState,
} from "./playoffs";

const data = loadGameData();
const draft = autoDraft(createDraft(data, 8), data);
const teams = draft.teams.map((_, i) => buildTeam(lineupOf(draft, i), data));
const user = userTeamIndex(draft);
const season = playRestOfSeason(createSeason(16, 8, user), teams);
const table = leagueTable(season);
const start = createPlayoffs(table, 8, user);
const done = playRestOfPlayoffs(start, teams);

describe("seeding and bracket", () => {
  it("seeds the top 8 of the table in order", () => {
    expect(start.seeds).toEqual(table.slice(0, 8).map((r) => r.team));
  });

  it("pairs the quarter-finals 1v8, 4v5, 2v7, 3v6", () => {
    const pairs = start.quarterFinals.map((t) => [seedOf(start, t.higher), seedOf(start, t.lower)]);
    expect(pairs).toEqual([
      [1, 8],
      [4, 5],
      [2, 7],
      [3, 6],
    ]);
  });

  it("sends the 1v8 and 4v5 winners into one semi-final and 2v7 and 3v6 into the other", () => {
    const qf = done.quarterFinals.map(tieWinner);
    expect(new Set([done.semiFinals[0].higher, done.semiFinals[0].lower])).toEqual(new Set([qf[0], qf[1]]));
    expect(new Set([done.semiFinals[1].higher, done.semiFinals[1].lower])).toEqual(new Set([qf[2], qf[3]]));
  });

  it("always makes the better seed the higher seed of a tie", () => {
    for (const t of [...done.quarterFinals, ...done.semiFinals]) {
      expect(seedOf(done, t.higher)!).toBeLessThan(seedOf(done, t.lower)!);
    }
    expect(seedOf(done, done.final!.home)!).toBeLessThan(seedOf(done, done.final!.away)!);
  });
});

describe("playing the playoffs", () => {
  it("goes QF leg 1 → QF leg 2 → SF leg 1 → SF leg 2 → Final", () => {
    const steps: string[] = [];
    let state = start;
    while (!isPlayoffsComplete(state)) {
      steps.push(nextStep(state)!);
      state = playNextStep(state, teams);
    }
    expect(steps).toEqual(["QF leg 1", "QF leg 2", "SF leg 1", "SF leg 2", "Final"]);
    expect(() => playNextStep(state, teams)).toThrow(/complete/);
  });

  it("never changes the previous state", () => {
    const snapshot = JSON.stringify(start);
    playNextStep(start, teams);
    expect(JSON.stringify(start)).toBe(snapshot);
  });

  it("never gives a first leg extra time", () => {
    for (const t of [...done.quarterFinals, ...done.semiFinals]) {
      expect(t.leg1!.extraTime).toBe(false);
      expect(t.leg1!.shootout).toBeNull();
    }
  });

  it("decides each tie on the aggregate, then extra time, then penalties", () => {
    for (const t of [...done.quarterFinals, ...done.semiFinals]) {
      const agg = tieAggregate(t)!;
      expect(t.leg2!.aggregate).toEqual({ home: agg.higher, away: agg.lower });
      if (agg.higher !== agg.lower) {
        expect(tieWinner(t)).toBe(agg.higher > agg.lower ? t.higher : t.lower);
        expect(t.leg2!.shootout).toBeNull();
      } else {
        expect(t.leg2!.extraTime).toBe(true);
        expect(t.leg2!.shootout).not.toBeNull();
      }
    }
  });

  it("plays one final with a winner", () => {
    const f = done.final!;
    expect(f.result!.aggregate).toBeNull();
    expect(f.result!.winner).not.toBeNull();
    expect(champion(done)).toBe(f.result!.winner === "home" ? f.home : f.away);
    expect([tieWinner(done.semiFinals[0]), tieWinner(done.semiFinals[1])].sort()).toEqual([f.home, f.away].sort());
  });

  it("keeps full detail only for the user's matches", () => {
    const all: [number, number, MatchResult][] = [
      ...[...done.quarterFinals, ...done.semiFinals].flatMap((t): [number, number, MatchResult][] => [
        [t.lower, t.higher, t.leg1!],
        [t.higher, t.lower, t.leg2!],
      ]),
      [done.final!.home, done.final!.away, done.final!.result!],
    ];
    for (const [home, away, r] of all) {
      if (home !== user && away !== user) expect(r.events.every((e) => e.type === "shot" && e.outcome === "goal")).toBe(true);
    }
  });

  it("survives a JSON round trip mid-playoffs and continues identically", () => {
    const midway = playNextStep(playNextStep(playNextStep(start, teams), teams), teams);
    const restored = JSON.parse(JSON.stringify(midway));
    expect(playRestOfPlayoffs(restored, teams)).toEqual(playRestOfPlayoffs(midway, teams));
  });
});

// ---------------------------------------------------------------------------
// Outcomes and the perfect season, on hand-built results.

function result(homeGoals: number, awayGoals: number, extra: Partial<MatchResult> = {}): MatchResult {
  return {
    homeGoals,
    awayGoals,
    events: [],
    stoppageTime: { firstHalf: 1, secondHalf: 3, extraTimeFirstHalf: null, extraTimeSecondHalf: null },
    extraTime: false,
    shootout: null,
    aggregate: null,
    winner: homeGoals > awayGoals ? "home" : awayGoals > homeGoals ? "away" : null,
    ...extra,
  };
}

// A finished league where `team` wins every match except those in `drop`.
function leagueWhere(team: number, drop: { matchday: number; score: [number, number] }[] = []): SeasonState {
  const s = createSeason(16, 1, team);
  return {
    ...s,
    matches: s.matches.map((m) => {
      const dropped = drop.find((d) => d.matchday === m.matchday);
      const involves = m.home === team || m.away === team;
      if (!involves) return { ...m, result: result(1, 1) };
      if (dropped) return { ...m, result: result(...dropped.score) };
      return { ...m, result: m.home === team ? result(2, 0) : result(0, 2) };
    }),
  };
}

// Plays the playoffs with hand-picked results: `userWins` decides every tie and
// final the team is in. Leg 1 is a user loss when `loseALeg` is set.
function playoffsWhere(
  league: SeasonState,
  team: number,
  { userWins, loseALeg = false, finalOnPenalties = false }: { userWins: boolean; loseALeg?: boolean; finalOnPenalties?: boolean },
): PlayoffState {
  let state = createPlayoffs(leagueTable(league), 1, team);
  const decideTie = (t: PlayoffState["quarterFinals"][number]) => {
    const userIn = t.higher === team || t.lower === team;
    const higherWins = userIn ? (t.higher === team) === userWins : true;
    // Leg 1 (lower seed at home): 1–0 to the lower seed if the user is the higher seed and loses a leg.
    const leg1 = loseALeg && userIn && t.higher === team ? result(1, 0) : result(0, 1);
    const leg1HigherGoals = leg1.awayGoals;
    const leg1LowerGoals = leg1.homeGoals;
    // Leg 2 (higher seed at home): enough to put the right team through on aggregate.
    const leg2 = higherWins ? result(leg1LowerGoals + 2, 0) : result(0, leg1HigherGoals + 2);
    const agg = { home: leg1HigherGoals + leg2.homeGoals, away: leg1LowerGoals + leg2.awayGoals };
    return { ...t, leg1, leg2: { ...leg2, aggregate: agg, winner: higherWins ? ("home" as const) : ("away" as const) } };
  };
  const pair = (a: number, b: number) => (state.seeds.indexOf(a) < state.seeds.indexOf(b) ? [a, b] : [b, a]);
  const quarterFinals = state.quarterFinals.map(decideTie);
  const w = quarterFinals.map((t) => tieWinner(t)!);
  const semiFinals = [pair(w[0], w[1]), pair(w[2], w[3])].map(([higher, lower]) =>
    decideTie({ round: "SF", higher, lower, leg1: null, leg2: null }),
  );
  const [home, away] = pair(tieWinner(semiFinals[0])!, tieWinner(semiFinals[1])!);
  const homeWins = home === team || away === team ? (home === team) === userWins : true;
  const finalResult = finalOnPenalties
    ? result(1, 1, {
        extraTime: true,
        shootout: { home: homeWins ? 4 : 2, away: homeWins ? 2 : 4, kicks: [] },
        winner: homeWins ? "home" : "away",
      })
    : homeWins
      ? result(2, 0)
      : result(0, 2);
  state = { ...state, quarterFinals, semiFinals, final: { home, away, result: finalResult } };
  return state;
}

describe("runOutcome and perfectSeason", () => {
  const me = 0;

  it("is a perfect season after 30 league wins, both ties and the final", () => {
    const league = leagueWhere(me);
    const playoffs = playoffsWhere(league, me, { userWins: true });
    expect(perfectSeason(league, playoffs, me)).toEqual({ wins: 35, target: 35, alive: true, perfect: true });
    expect(runOutcome(league, playoffs, me)).toEqual({ kind: "champion", perfect: true });
  });

  it("counts a tie won on aggregate as two wins even after losing a leg", () => {
    const league = leagueWhere(me);
    const playoffs = playoffsWhere(league, me, { userWins: true, loseALeg: true });
    expect(playoffs.quarterFinals[0].leg1!.homeGoals).toBe(1); // the user lost leg 1
    expect(perfectSeason(league, playoffs, me).perfect).toBe(true);
  });

  it("counts a final won on penalties", () => {
    const league = leagueWhere(me);
    const playoffs = playoffsWhere(league, me, { userWins: true, finalOnPenalties: true });
    expect(runOutcome(league, playoffs, me)).toEqual({ kind: "champion", perfect: true });
  });

  it("is a non-perfect title after one league draw", () => {
    const league = leagueWhere(me, [{ matchday: 4, score: [1, 1] }]);
    const playoffs = playoffsWhere(league, me, { userWins: true });
    expect(perfectSeason(league, playoffs, me)).toMatchObject({ alive: false, perfect: false });
    expect(runOutcome(league, playoffs, me)).toEqual({ kind: "champion", perfect: false });
  });

  it("reports elimination by round", () => {
    const league = leagueWhere(me);
    expect(runOutcome(league, playoffsWhere(league, me, { userWins: false }), me)).toEqual({
      kind: "eliminated",
      round: "QF",
    });
    expect(perfectSeason(league, playoffsWhere(league, me, { userWins: false }), me).alive).toBe(false);
  });

  it("reports relegation when the user misses the top 8", () => {
    // The user loses every match; everyone else draws, so the user finishes last.
    const s = createSeason(16, 1, me);
    const league: SeasonState = {
      ...s,
      matches: s.matches.map((m) => ({
        ...m,
        result: m.home === me ? result(0, 1) : m.away === me ? result(1, 0) : result(1, 1),
      })),
    };
    expect(runOutcome(league, null, me)).toEqual({ kind: "relegated", position: 16 });
    expect(perfectSeason(league, null, me).alive).toBe(false);
  });

  it("is in progress while the season or playoffs are unfinished", () => {
    const league = leagueWhere(me);
    expect(runOutcome(createSeason(16, 1, me), null, me)).toEqual({ kind: "inProgress" });
    expect(runOutcome(league, null, me)).toEqual({ kind: "inProgress" });
    expect(runOutcome(league, createPlayoffs(leagueTable(league), 1, me), me)).toEqual({ kind: "inProgress" });
    expect(perfectSeason(league, null, me)).toEqual({ wins: 30, target: 35, alive: true, perfect: false });
  });

  it("agrees with a real simulated run", () => {
    const outcome = runOutcome(season, done, user);
    expect(outcome.kind).not.toBe("inProgress");
    if (outcome.kind === "champion") expect(champion(done)).toBe(user);
  });
});

describe("perfectTrack (the 35 progress dots)", () => {
  const me = 0;
  const count = (marks: string[], m: string) => marks.filter((x) => x === m).length;

  it("is 35 upcoming dots before a ball is kicked", () => {
    const marks = perfectTrack(createSeason(16, 1, me), null, me);
    expect(marks).toHaveLength(35);
    expect(count(marks, "upcoming")).toBe(35);
  });

  it("is 35 wins for a perfect season", () => {
    const league = leagueWhere(me);
    expect(count(perfectTrack(league, playoffsWhere(league, me, { userWins: true }), me), "win")).toBe(35);
  });

  it("marks a dropped league match on its matchday", () => {
    const league = leagueWhere(me, [{ matchday: 4, score: [1, 1] }]);
    const marks = perfectTrack(league, null, me);
    expect(marks[3]).toBe("dropped");
    expect(count(marks.slice(0, 30), "win")).toBe(29);
    expect(marks.slice(30)).toEqual(Array(5).fill("upcoming"));
  });

  it("counts both legs of a tie won after losing a leg", () => {
    const league = leagueWhere(me);
    const marks = perfectTrack(league, playoffsWhere(league, me, { userWins: true, loseALeg: true }), me);
    expect(marks.slice(30, 34)).toEqual(["win", "win", "win", "win"]);
  });

  it("drops a lost tie and voids the rounds never reached", () => {
    const league = leagueWhere(me);
    const marks = perfectTrack(league, playoffsWhere(league, me, { userWins: false }), me);
    expect(marks.slice(30)).toEqual(["dropped", "dropped", "void", "void", "void"]);
  });

  it("voids the knockouts after relegation", () => {
    const s = createSeason(16, 1, me);
    const league: SeasonState = {
      ...s,
      matches: s.matches.map((m) => ({
        ...m,
        result: m.home === me ? result(0, 1) : m.away === me ? result(1, 0) : result(1, 1),
      })),
    };
    expect(perfectTrack(league, null, me).slice(30)).toEqual(Array(5).fill("void"));
  });
});
