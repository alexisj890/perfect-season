// Penalty practice: a running session of shots with goals, streak and best
// streak. Pure (a reducer), so it can be tested and its state can outlive the
// modal the game is shown in.

import { newRound, shoot, step, type Outcome, type PenaltyState, type Point } from "./penalty";

export const RESULT_PAUSE = 1.2; // seconds the result stays up before the next ball

export interface Practice {
  round: PenaltyState;
  goals: number;
  shots: number;
  streak: number;
  best: number;
  pause: number; // counts down after a result
}

export type PracticeAction =
  | { type: "tick"; dt: number; nextSpot: Point }
  | { type: "shoot"; pointer: Point; keeperGuessError: number };

export function startPractice(best = 0): Practice {
  return { round: newRound(), goals: 0, shots: 0, streak: 0, best, pause: 0 };
}

export function practiceReducer(game: Practice, action: PracticeAction): Practice {
  if (action.type === "shoot") return { ...game, round: shoot(game.round, action.pointer, action.keeperGuessError) };

  if (game.round.phase === "done") {
    const pause = game.pause - action.dt;
    return pause > 0 ? { ...game, pause } : { ...game, pause: 0, round: newRound(action.nextSpot) };
  }
  const round = step(game.round, action.dt, game.streak);
  if (round.phase !== "done") return { ...game, round };
  return { ...recordShot(game, round.outcome!), round, pause: RESULT_PAUSE };
}

function recordShot(game: Practice, outcome: Outcome): Practice {
  const scored = outcome === "goal";
  const streak = scored ? game.streak + 1 : 0;
  return {
    ...game,
    goals: game.goals + (scored ? 1 : 0),
    shots: game.shots + 1,
    streak,
    best: Math.max(game.best, streak),
  };
}
