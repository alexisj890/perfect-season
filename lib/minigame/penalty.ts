// The landing page penalty mini-game: pure rules, no drawing. The component in
// components/home/PenaltyGame.tsx draws this state and feeds in mouse drags and time.
//
// Coordinates match the SVG: x 0–100 left to right, y 0–64 top to bottom
// (the goal end of the pitch). The goal is at the top; the shooter kicks upwards.

export const PITCH = {
  width: 100,
  height: 64,
  goalLineY: 12,
  goalLeft: 36,
  goalRight: 64,
  postRadius: 0.8,
  ballRadius: 1.4,
  keeperY: 13.5,
  keeperHalfWidth: 3,
  penaltySpot: { x: 50, y: 36 },
} as const;

export const SHOT = {
  minSpeed: 15, // units per second at zero power (too soft to reach the goal)
  maxSpeed: 140,
  friction: 1.2, // speed falls by e^(−friction) each second
  fullPowerDrag: 25, // drag this far for full power
  overTheBarPower: 0.92, // above this, the shot sails over the bar
  minDrag: 2, // shorter drags are treated as a click, not a shot
};

export const KEEPER = {
  patrolRange: 9, // sways ±9 units while the shooter aims
  patrolSpeed: 1.6,
  reactionDelay: 0.12, // seconds before he moves after the kick
  baseSpeed: 28, // units per second; +3 per goal in the current streak
  speedPerStreak: 3,
  maxSpeed: 50,
};

export type Outcome = "goal" | "saved" | "post" | "wide" | "over" | "short";

export interface Point {
  x: number;
  y: number;
}

export interface PenaltyState {
  phase: "aiming" | "flying" | "done";
  ball: Point;
  velocity: Point;
  keeperX: number;
  keeperTarget: number; // where the keeper is diving to once the ball is struck
  time: number; // seconds since the round started
  shotAt: number | null; // time of the kick
  power: number; // 0–1, of the current shot
  outcome: Outcome | null;
}

export function newRound(spot: Point = PITCH.penaltySpot): PenaltyState {
  return {
    phase: "aiming",
    ball: { ...spot },
    velocity: { x: 0, y: 0 },
    keeperX: 50,
    keeperTarget: 50,
    time: 0,
    shotAt: null,
    power: 0,
    outcome: null,
  };
}

// The shot a drag would produce: aim is opposite the drag (like a slingshot),
// power grows with drag length. Null if the drag is too short to count.
export function aimFromDrag(ball: Point, pointer: Point): { direction: Point; power: number } | null {
  const dx = pointer.x - ball.x;
  const dy = pointer.y - ball.y;
  const length = Math.hypot(dx, dy);
  if (length < SHOT.minDrag) return null;
  return { direction: { x: -dx / length, y: -dy / length }, power: Math.min(length / SHOT.fullPowerDrag, 1) };
}

// Strikes the ball. `keeperGuessError` nudges where the keeper dives (the
// component passes a little randomness so he isn't perfect).
export function shoot(state: PenaltyState, pointer: Point, keeperGuessError = 0): PenaltyState {
  if (state.phase !== "aiming") return state;
  const aim = aimFromDrag(state.ball, pointer);
  if (!aim) return state;
  const speed = SHOT.minSpeed + aim.power * (SHOT.maxSpeed - SHOT.minSpeed);
  const velocity = { x: aim.direction.x * speed, y: aim.direction.y * speed };
  // The keeper reads the line of the shot and heads for where it will cross him.
  const crossing =
    velocity.y < 0
      ? state.ball.x + (velocity.x * (PITCH.keeperY - state.ball.y)) / velocity.y
      : state.keeperX;
  const keeperTarget = clamp(crossing + keeperGuessError, PITCH.goalLeft - 2, PITCH.goalRight + 2);
  return { ...state, phase: "flying", velocity, keeperTarget, shotAt: state.time, power: aim.power };
}

export function keeperSpeed(streak: number): number {
  return Math.min(KEEPER.baseSpeed + KEEPER.speedPerStreak * streak, KEEPER.maxSpeed);
}

// Advances the round by `dt` seconds.
export function step(state: PenaltyState, dt: number, streak = 0): PenaltyState {
  if (state.phase === "done") return state;
  const time = state.time + dt;

  if (state.phase === "aiming") {
    const keeperX = 50 + KEEPER.patrolRange * Math.sin(time * KEEPER.patrolSpeed);
    return { ...state, time, keeperX };
  }

  // Keeper: waits for his reaction time, then moves toward his target.
  let keeperX = state.keeperX;
  if (time - state.shotAt! > KEEPER.reactionDelay) {
    const move = keeperSpeed(streak) * dt;
    const gap = state.keeperTarget - keeperX;
    keeperX += Math.sign(gap) * Math.min(Math.abs(gap), move);
  }

  // Ball: moves, slowing with friction.
  const decay = Math.exp(-SHOT.friction * dt);
  const velocity = { x: state.velocity.x * decay, y: state.velocity.y * decay };
  const before = state.ball;
  const ball = { x: before.x + velocity.x * dt, y: before.y + velocity.y * dt };
  const next: PenaltyState = { ...state, time, keeperX, ball, velocity };

  // Did the ball reach the keeper's line this step, within his reach?
  if (before.y > PITCH.keeperY && ball.y <= PITCH.keeperY && state.power <= SHOT.overTheBarPower) {
    const x = interpolateX(before, ball, PITCH.keeperY);
    if (Math.abs(x - keeperX) <= PITCH.keeperHalfWidth + PITCH.ballRadius) {
      return finish({ ...next, ball: { x, y: PITCH.keeperY } }, "saved");
    }
  }

  // Did it cross the goal line?
  if (ball.y <= PITCH.goalLineY) {
    const x = interpolateX(before, ball, PITCH.goalLineY);
    const at = { x, y: PITCH.goalLineY };
    if (state.power > SHOT.overTheBarPower) return finish({ ...next, ball: at }, "over");
    const nearPost = [PITCH.goalLeft, PITCH.goalRight].some(
      (post) => Math.abs(x - post) <= PITCH.postRadius + PITCH.ballRadius,
    );
    if (nearPost) return finish({ ...next, ball: at }, "post");
    if (x > PITCH.goalLeft && x < PITCH.goalRight) return finish({ ...next, ball: { x, y: PITCH.goalLineY - 3 } }, "goal");
    return finish({ ...next, ball: at }, "wide");
  }

  // Off the side or back of the pitch, or rolled to a stop.
  if (ball.x < 0 || ball.x > PITCH.width || ball.y > PITCH.height) return finish(next, "wide");
  if (Math.hypot(velocity.x, velocity.y) < 2) return finish(next, "short");
  return next;
}

function finish(state: PenaltyState, outcome: Outcome): PenaltyState {
  return { ...state, phase: "done", velocity: { x: 0, y: 0 }, outcome };
}

function interpolateX(a: Point, b: Point, y: number): number {
  if (a.y === b.y) return b.x;
  return a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// A random spot in the box to shoot from next (pass Math.random or a seeded source).
export function randomSpot(random: () => number): Point {
  return { x: 34 + random() * 32, y: 30 + random() * 14 };
}

// Runs a shot to the end (for tests): steps until the round is over.
export function playOut(state: PenaltyState, streak = 0, dt = 1 / 120): PenaltyState {
  let s = state;
  for (let i = 0; i < 2000 && s.phase === "flying"; i++) s = step(s, dt, streak);
  return s;
}
