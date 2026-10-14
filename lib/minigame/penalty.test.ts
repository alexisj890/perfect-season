import { describe, expect, it } from "vitest";
import { aimFromDrag, keeperSpeed, newRound, PITCH, playOut, shoot, SHOT, step, type Point } from "./penalty";

const spot = PITCH.penaltySpot;

// A drag that aims at `target` with the given power (0–1): pull back the opposite way.
function dragToward(target: Point, power: number, from: Point = spot): Point {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const len = Math.hypot(dx, dy);
  const pull = power * SHOT.fullPowerDrag;
  return { x: from.x - (dx / len) * pull, y: from.y - (dy / len) * pull };
}

// Keeper standing still in the middle when the ball is struck.
function kick(target: Point, power: number, keeperX = 50) {
  const round = { ...newRound(), keeperX };
  return playOut(shoot(round, dragToward(target, power)));
}

describe("aimFromDrag", () => {
  it("aims opposite the drag, with power growing to a cap", () => {
    const aim = aimFromDrag(spot, { x: 50, y: 36 + SHOT.fullPowerDrag / 2 })!;
    expect(aim.direction.x).toBeCloseTo(0);
    expect(aim.direction.y).toBeCloseTo(-1);
    expect(aim.power).toBeCloseTo(0.5);
    expect(aimFromDrag(spot, { x: 50, y: 200 })!.power).toBe(1);
  });

  it("ignores tiny drags (a click isn't a shot)", () => {
    expect(aimFromDrag(spot, { x: 50.5, y: 36.5 })).toBeNull();
    const round = newRound();
    expect(shoot(round, { x: 50.5, y: 36.5 })).toBe(round);
  });
});

describe("shot outcomes", () => {
  it("scores in the corner", () => {
    expect(kick({ x: PITCH.goalLeft + 4, y: PITCH.goalLineY }, 0.8).outcome).toBe("goal");
    expect(kick({ x: PITCH.goalRight - 4, y: PITCH.goalLineY }, 0.8).outcome).toBe("goal");
  });

  it("gets saved straight at the keeper", () => {
    expect(kick({ x: 50, y: PITCH.goalLineY }, 0.8).outcome).toBe("saved");
  });

  it("hits the post", () => {
    expect(kick({ x: PITCH.goalLeft, y: PITCH.goalLineY }, 0.8).outcome).toBe("post");
  });

  it("goes wide", () => {
    expect(kick({ x: 20, y: PITCH.goalLineY }, 0.8).outcome).toBe("wide");
  });

  it("flies over the bar when overhit", () => {
    expect(kick({ x: PITCH.goalLeft + 4, y: PITCH.goalLineY }, 1).outcome).toBe("over");
  });

  it("stops short when too soft", () => {
    // Just past the minimum drag that counts as a shot.
    expect(kick({ x: PITCH.goalLeft + 4, y: PITCH.goalLineY }, 0.09).outcome).toBe("short");
  });

  it("goes wide when shot backwards", () => {
    expect(kick({ x: 50, y: 110 }, 0.8).outcome).toBe("wide");
  });
});

describe("the keeper", () => {
  it("sways while the shooter aims", () => {
    const xs = [0.5, 1, 1.5, 2].map((t) => step(newRound(), t).keeperX);
    expect(new Set(xs.map((x) => x.toFixed(2))).size).toBeGreaterThan(1);
    for (const x of xs) expect(Math.abs(x - 50)).toBeLessThanOrEqual(9);
  });

  it("dives toward the shot and saves a weak one to the corner", () => {
    expect(kick({ x: PITCH.goalLeft + 4, y: PITCH.goalLineY }, 0.25).outcome).toBe("saved");
  });

  it("gets quicker with the streak, up to a limit", () => {
    expect(keeperSpeed(3)).toBeGreaterThan(keeperSpeed(0));
    expect(keeperSpeed(100)).toBe(keeperSpeed(1000));
  });

  it("does nothing more once the round is over", () => {
    const done = kick({ x: 20, y: PITCH.goalLineY }, 0.8);
    expect(step(done, 1)).toBe(done);
  });
});
