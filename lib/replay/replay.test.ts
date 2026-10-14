import { describe, expect, it } from "vitest";
import { loadGameData } from "@/lib/data/load";
import { lineupByRank } from "@/lib/engine/lineups";
import { goalsOf, simulateMatch, type MatchResult } from "@/lib/engine/match";
import { buildTeam } from "@/lib/engine/team";
import { createRng } from "@/lib/rng";
import { ballPosition, basePosition, buildReplay, clockAt, PITCH_LENGTH, PITCH_WIDTH, playerPosition } from "./replay";

const data = loadGameData();
const slots = data.formation.slots;
const home = buildTeam(lineupByRank(data, [2, 3]), data);
const away = buildTeam(lineupByRank(data, [7, 8]), data);
const rng = createRng(4);
const matches: { result: MatchResult; key: string }[] = Array.from({ length: 60 }, (_, i) => ({
  result: simulateMatch(home, away, rng, i % 10 === 0 ? { kind: "final" } : { kind: "league" }),
  key: `test-${i}`,
}));
const scripts = matches.map((m) => ({ ...m, script: buildReplay(m.result, home, away, slots, m.key) }));

describe("buildReplay", () => {
  it("is the same every time for the same match", () => {
    const { result, key, script } = scripts[0];
    expect(buildReplay(result, home, away, slots, key)).toEqual(script);
  });

  it("puts all 22 players on the pitch from the formation data", () => {
    const { script } = scripts[0];
    expect(script.players).toHaveLength(22);
    const keeper = script.players.find((p) => p.side === "home" && p.isKeeper)!;
    const gk = slots.find((s) => s.id === "GK")!;
    expect({ x: keeper.baseX, y: keeper.baseY }).toEqual(basePosition(gk.pitchX, gk.pitchY, "home"));
    expect(keeper.baseX).toBeLessThan(PITCH_LENGTH / 4); // home keeper guards the left goal
    expect(script.players.find((p) => p.side === "away" && p.isKeeper)!.baseX).toBeGreaterThan((PITCH_LENGTH * 3) / 4);
  });

  it("feeds every shot, with a running score that ends on the real score", () => {
    for (const { result, script } of scripts) {
      const shots = result.events.filter((e) => e.type === "shot");
      expect(script.feed).toHaveLength(shots.length);
      const last = script.feed.at(-1);
      expect(last ? last.score : { home: 0, away: 0 }).toEqual({ home: result.homeGoals, away: result.awayGoals });
      expect(script.feed.filter((f) => f.kind === "goal")).toHaveLength(goalsOf(result).length);
      const times = script.feed.map((f) => f.t);
      expect(times).toEqual([...times].sort((a, b) => a - b));
    }
  });

  it("has the ball in the net at the right end when each goal goes in", () => {
    for (const { script } of scripts) {
      for (const goal of script.feed.filter((f) => f.kind === "goal")) {
        const ball = ballPosition(script, goal.t + 0.05);
        if (goal.side === "home") expect(ball.x).toBeGreaterThan(PITCH_LENGTH);
        else expect(ball.x).toBeLessThan(0);
        expect(Math.abs(ball.y - PITCH_WIDTH / 2)).toBeLessThan(3.66);
      }
    }
  });

  it("shows each event at its real clock time, stoppage time included", () => {
    for (const { script } of scripts) {
      for (const item of script.feed) expect(clockAt(script, item.t)).toEqual(item.clock);
    }
    const { script } = scripts[1];
    const firstHalfEnd = script.periods[0].end;
    expect(clockAt(script, 0)).toEqual({ minute: 1, addedTime: 0 });
    expect(clockAt(script, 44 * 60 + 30)).toEqual({ minute: 45, addedTime: 0 });
    expect(clockAt(script, firstHalfEnd - 1)).toEqual({ minute: 45, addedTime: matches[1].result.stoppageTime.firstHalf });
    expect(clockAt(script, firstHalfEnd + 1)).toEqual({ minute: 46, addedTime: 0 });
  });

  it("adds extra-time periods only when the match had them", () => {
    for (const { result, script } of scripts) {
      expect(script.periods).toHaveLength(result.extraTime ? 4 : 2);
    }
  });

  it("keeps players on the pitch and the ball near it", () => {
    const { script } = scripts[2];
    for (let t = 0; t < script.duration; t += 7) {
      for (const p of script.players) {
        const pos = playerPosition(script, p, t);
        expect(pos.x).toBeGreaterThanOrEqual(0);
        expect(pos.x).toBeLessThanOrEqual(PITCH_LENGTH);
        expect(pos.y).toBeGreaterThanOrEqual(0);
        expect(pos.y).toBeLessThanOrEqual(PITCH_WIDTH);
      }
      const ball = ballPosition(script, t);
      expect(ball.x).toBeGreaterThan(-3);
      expect(ball.x).toBeLessThan(PITCH_LENGTH + 3);
      expect(ball.y).toBeGreaterThan(-1);
      expect(ball.y).toBeLessThan(PITCH_WIDTH + 1);
    }
  });

  it("pushes the side with the ball forward", () => {
    const { script } = scripts[3];
    const span = script.possession.find((s) => s.push === 1 && s.side === "home" && s.to - s.from >= 13)!;
    const striker = script.players.find((p) => p.side === "home" && p.slot === "ST")!;
    expect(playerPosition(script, striker, span.to - 0.5).x).toBeGreaterThan(striker.baseX + 8);
  });
});
