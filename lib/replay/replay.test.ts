import { describe, expect, it } from "vitest";
import { loadGameData } from "@/lib/data/load";
import { lineupByRank } from "@/lib/engine/lineups";
import { goalsOf, simulateMatch, type MatchResult } from "@/lib/engine/match";
import { buildTeam } from "@/lib/engine/team";
import { createRng } from "@/lib/rng";
import {
  advance,
  ballPosition,
  basePosition,
  buildReplay,
  clockAt,
  PITCH_LENGTH,
  PITCH_WIDTH,
  playerPosition,
  rateAt,
  realDuration,
  TARGET_REAL_SECONDS,
  type ReplayScript,
} from "./replay";

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
      expect(script.feed.filter((f) => f.kind !== "corner")).toHaveLength(shots.length);
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

// How the replay looks when played: things a viewer would notice.
describe("replay playback", () => {
  const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  const playerOf = (script: ReplayScript, side: "home" | "away", id: string) =>
    script.players.find((p) => p.side === side && p.playerId === id)!;

  it("covers the whole match with speed segments and takes about 3 minutes at 1×", () => {
    for (const { script } of scripts) {
      expect(script.segments[0].from).toBe(0);
      expect(script.segments.at(-1)!.to).toBe(script.duration);
      script.segments.forEach((seg, i) => i > 0 && expect(seg.from).toBe(script.segments[i - 1].to));
      expect(realDuration(script)).toBeGreaterThan(TARGET_REAL_SECONDS * 0.8);
      expect(realDuration(script)).toBeLessThan(TARGET_REAL_SECONDS * 1.6);
    }
  });

  it("plays every shot in slow motion", () => {
    for (const { script } of scripts) {
      for (const f of script.feed) expect(rateAt(script, f.t - 0.5)).toBeLessThanOrEqual(5);
    }
  });

  it("moves the ball visibly between players instead of teleporting", () => {
    let passes = 0;
    let visible = 0;
    for (const { script } of scripts.slice(0, 20)) {
      const w = script.waypoints;
      for (let i = 1; i < w.length; i++) {
        const from = ballPosition(script, w[i].t - Math.min(w[i].travel, w[i].t - w[i - 1].t - 0.05) - 0.01);
        const to = ballPosition(script, w[i].t);
        if (near(from, to) < 4) continue; // a short tap or a hand-off
        passes++;
        const onScreen = Math.min(w[i].travel, w[i].t - w[i - 1].t - 0.05) / rateAt(script, w[i].t - 0.01);
        if (onScreen >= 0.2) visible++;
      }
    }
    expect(visible / passes).toBeGreaterThan(0.95);
  });

  it("shows each shot travelling for at least a quarter of a second", () => {
    for (const { script } of scripts) {
      for (const f of script.feed) {
        const w = script.waypoints.find((x) => Math.abs(x.t - f.t) < 0.01)!;
        expect(w.travel / rateAt(script, f.t - 0.01)).toBeGreaterThanOrEqual(0.25);
      }
    }
  });

  it("takes open-play shots from near goal, and the keeper reaches the ball on a save", () => {
    for (const { script } of scripts) {
      for (const f of script.feed) {
        const goalX = f.side === "home" ? PITCH_LENGTH : 0;
        if (f.shot.source === "open play") {
          const shooter = playerOf(script, f.side, f.shot.shooterId);
          expect(Math.abs(playerPosition(script, shooter, f.t - 0.2).x - goalX)).toBeLessThan(30);
        }
        if (f.kind === "save") {
          const keeper = script.players.find((p) => p.side !== f.side && p.isKeeper)!;
          expect(near(playerPosition(script, keeper, f.t), ballPosition(script, f.t))).toBeLessThan(2);
        }
      }
    }
  });

  it("changes possession by interception, to the opponent nearest the ball", () => {
    const { script } = scripts[5];
    const w = script.waypoints;
    let checked = 0;
    for (let i = 1; i < w.length; i++) {
      const a = w[i - 1].target;
      const b = w[i].target;
      if (a.kind !== "player" || b.kind !== "player" || a.side === b.side) continue;
      const leave = w[i].t - Math.min(w[i].travel, w[i].t - w[i - 1].t - 0.05);
      const ball = ballPosition(script, leave);
      const receiver = script.players.find((p) => p.side === b.side && p.index === b.index)!;
      const distances = script.players
        .filter((p) => p.side === b.side && !p.isKeeper)
        .map((p) => near(playerPosition(script, p, leave), ball));
      expect(near(playerPosition(script, receiver, leave), ball)).toBeLessThanOrEqual(Math.min(...distances) + 15);
      checked++;
    }
    expect(checked).toBeGreaterThan(5);
  });
});

describe("replay smoothness (no teleporting)", () => {
  it("never moves a player or the ball implausibly far between two frames at 1×", () => {
    let worstBall = 0;
    let worstPlayer = 0;
    for (const { script } of scripts.slice(0, 3)) {
      let t = 0;
      let ball = ballPosition(script, 0);
      let players = script.players.map((p) => playerPosition(script, p, 0));
      while (t < script.duration) {
        const before = t;
        t = advance(script, t, 1 / 60); // one frame at 60 fps
        const nowBall = ballPosition(script, t);
        const nowPlayers = script.players.map((p) => playerPosition(script, p, t));
        // Half-time is a deliberate reset, hidden behind the half-time banner.
        if (!script.periods.some((p) => p.end > before && p.end <= t)) {
          worstBall = Math.max(worstBall, Math.hypot(nowBall.x - ball.x, nowBall.y - ball.y));
          nowPlayers.forEach((p, k) => (worstPlayer = Math.max(worstPlayer, Math.hypot(p.x - players[k].x, p.y - players[k].y))));
        }
        ball = nowBall;
        players = nowPlayers;
      }
    }
    expect(worstPlayer).toBeLessThan(6); // metres in one frame
    expect(worstBall).toBeLessThan(10); // a hard shot, at most
  });

  it("advances each part of the match at its own speed", () => {
    const { script } = scripts[0];
    const fast = script.segments.find((s) => s.rate > 10)!;
    const slow = script.segments.find((s) => s.from === fast.to)!;
    // One real second starting just before a fast→slow change: almost all of it is spent in the slow part.
    const t = advance(script, fast.to - 1, 1);
    expect(t).toBeGreaterThan(fast.to);
    expect(t - fast.to).toBeLessThanOrEqual(slow.rate);
  });
});

describe("set pieces and winning the ball", () => {
  it("only gives a corner after the ball goes out off a defender", () => {
    let won = 0;
    for (const { script } of scripts) {
      for (const f of script.feed.filter((x) => x.kind === "corner")) {
        won++;
        // The last touch before the ball went out was a defender's.
        const out = script.waypoints.findIndex((w) => Math.abs(w.t - f.t) < 0.01);
        const lastTouch = script.waypoints[out - 1].target;
        if (lastTouch.kind !== "player") throw new Error("a corner must come off a player");
        expect(lastTouch.side).not.toBe(f.side);
        const blocker = script.players.find((p) => p.side === lastTouch.side && p.index === lastTouch.index)!;
        expect(f.blockerId).toBe(blocker.playerId);
        const ball = ballPosition(script, f.t + 0.05);
        expect(ball.x < 0 || ball.x > PITCH_LENGTH).toBe(true);
      }
    }
    expect(won).toBeGreaterThan(10);
  });

  it("takes every corner from the corner flag, usually after the ball goes out of play", () => {
    let corners = 0;
    let clearedFirst = 0;
    for (const { script } of scripts) {
      for (const f of script.feed.filter((x) => x.kind !== "corner" && x.shot.source === "corner")) {
        corners++;
        const placed = ballPosition(script, f.t - 3);
        const flags = [0.6, PITCH_LENGTH - 0.6].flatMap((x) => [0.6, PITCH_WIDTH - 0.6].map((y) => ({ x, y })));
        expect(Math.min(...flags.map((q) => Math.hypot(placed.x - q.x, placed.y - q.y)))).toBeLessThan(1);
        const before = ballPosition(script, f.t - 7);
        if (before.x < 0 || before.x > PITCH_LENGTH) clearedFirst++;
      }
    }
    expect(corners).toBeGreaterThan(10);
    expect(clearedFirst / corners).toBeGreaterThan(0.8);
  });

  it("wins the ball with tackles and interceptions, not passes to the other team", () => {
    const moves: number[] = [];
    for (const { script } of scripts.slice(0, 20)) {
      const w = script.waypoints;
      for (let k = 1; k < w.length; k++) {
        const a = w[k - 1].target;
        const b = w[k].target;
        if (a.kind !== "player" || b.kind !== "player" || a.side === b.side) continue;
        if (script.feed.some((f) => w[k].t - f.t > 0 && w[k].t - f.t < 15)) continue; // restarts after a shot
        const leave = w[k].t - Math.min(w[k].travel, w[k].t - w[k - 1].t - 0.05);
        const from = ballPosition(script, leave);
        const to = ballPosition(script, w[k].t);
        moves.push(Math.hypot(to.x - from.x, to.y - from.y));
      }
    }
    moves.sort((x, y) => x - y);
    expect(moves.length).toBeGreaterThan(50);
    expect(moves[Math.floor(moves.length / 2)]).toBeLessThan(6); // most changes are tackles: the ball barely moves
    expect(moves.at(-1)!).toBeLessThan(40); // interceptions cut a pass out early
  });
});
