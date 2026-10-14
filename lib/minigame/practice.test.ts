import { describe, expect, it } from "vitest";
import { PITCH, SHOT, type Point } from "./penalty";
import { practiceReducer, RESULT_PAUSE, startPractice, type Practice } from "./practice";

const spot = PITCH.penaltySpot;
const next = { x: 50, y: 40 };

function dragToward(target: Point, power: number): Point {
  const dx = target.x - spot.x;
  const dy = target.y - spot.y;
  const len = Math.hypot(dx, dy);
  return { x: spot.x - (dx / len) * power * SHOT.fullPowerDrag, y: spot.y - (dy / len) * power * SHOT.fullPowerDrag };
}

// Takes one shot (keeper frozen in the middle) and plays it out.
function takeShot(game: Practice, target: Point, power: number): Practice {
  let g: Practice = { ...game, round: { ...game.round, keeperX: 50 } };
  g = practiceReducer(g, { type: "shoot", pointer: dragToward(target, power), keeperGuessError: 0 });
  for (let i = 0; i < 400 && g.round.phase === "flying"; i++) g = practiceReducer(g, { type: "tick", dt: 1 / 120, nextSpot: next });
  return g;
}

const corner = { x: PITCH.goalLeft + 4, y: PITCH.goalLineY };
const middle = { x: 50, y: PITCH.goalLineY };

describe("penalty practice", () => {
  it("counts goals, shots and the streak", () => {
    let g = takeShot(startPractice(), corner, 0.8);
    expect(g).toMatchObject({ goals: 1, shots: 1, streak: 1, best: 1 });
    g = takeShot({ ...g, round: startPractice().round }, corner, 0.8);
    expect(g).toMatchObject({ goals: 2, shots: 2, streak: 2, best: 2 });
  });

  it("resets the streak on a miss but keeps the best", () => {
    let g = takeShot(startPractice(), corner, 0.8);
    g = takeShot({ ...g, round: startPractice().round }, middle, 0.8);
    expect(g).toMatchObject({ goals: 1, shots: 2, streak: 0, best: 1 });
  });

  it("starts from a remembered best", () => {
    expect(startPractice(7).best).toBe(7);
    expect(takeShot(startPractice(7), corner, 0.8).best).toBe(7);
  });

  it("shows the result for a moment, then sets up the next ball", () => {
    let g = takeShot(startPractice(), corner, 0.8);
    expect(g.round.phase).toBe("done");
    g = practiceReducer(g, { type: "tick", dt: RESULT_PAUSE / 2, nextSpot: next });
    expect(g.round.phase).toBe("done");
    g = practiceReducer(g, { type: "tick", dt: RESULT_PAUSE, nextSpot: next });
    expect(g.round.phase).toBe("aiming");
    expect(g.round.ball).toEqual(next);
    expect(g.shots).toBe(1); // the score carries on
  });
});
