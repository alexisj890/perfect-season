// Computer picks: each team drafts according to its style, with some
// randomness set by the difficulty.

import type { GameData } from "@/lib/data/types";
import { createRng, weightedPick, type Rng } from "@/lib/rng";
import { DRAFT, type DrafterSettings } from "./config";
import { currentTurn, makePick, type DraftState, type PickTurn } from "./draft";
import { scoreOptions, type DraftStyle, type PickOption } from "./styles";

export interface Drafter {
  style: DraftStyle;
  candidates: number;
  temperature: number;
}

// How the computer drafts for a team: its style plus the difficulty's sharpness.
export function drafterFor(state: DraftState, teamIndex: number): Drafter {
  const settings: DrafterSettings = DRAFT.difficulties[state.difficulty];
  const style = state.teams[teamIndex].style ?? "balanced"; // auto-picks for the user draft sensibly
  return { style, candidates: settings.candidates, temperature: settings.temperature };
}

// One of the drafter's best few options, weighted toward the very best.
export function chooseOption(state: DraftState, data: GameData, drafter: Drafter, rng: Rng): PickOption {
  const turn = currentTurn(state);
  if (!turn) throw new Error("The draft is already complete");
  const options = scoreOptions(state, data, turn.teamIndex, drafter.style).slice(0, drafter.candidates);
  const best = options[0].value;
  return weightedPick(rng, options, (o) => Math.exp(-(best - o.value) / drafter.temperature));
}

// Lets computer teams pick until it's the user's turn (or the draft ends).
export function runCpuPicks(state: DraftState, data: GameData): DraftState {
  return autoPick(state, data, (turn) => state.teams[turn.teamIndex].isUser);
}

// Finishes the whole draft, picking for the user too. `userDrafter` overrides
// how the user's picks are made (used by simulations).
export function autoDraft(state: DraftState, data: GameData, userDrafter?: Drafter): DraftState {
  return autoPick(state, data, () => false, userDrafter);
}

function autoPick(
  state: DraftState,
  data: GameData,
  stopAt: (turn: PickTurn) => boolean,
  userDrafter?: Drafter,
): DraftState {
  const rng = createRng(state.rngState);
  let next = state;
  for (let turn = currentTurn(next); turn && !stopAt(turn); turn = currentTurn(next)) {
    const isUser = next.teams[turn.teamIndex].isUser;
    const drafter = isUser && userDrafter ? userDrafter : drafterFor(next, turn.teamIndex);
    const choice = chooseOption(next, data, drafter, rng);
    next = makePick(next, data, choice.playerId, choice.slot);
  }
  return { ...next, rngState: rng.state() };
}

// How the user's Auto-pick button drafts: the best-rated player for an open slot.
export const BEST_AVAILABLE: Drafter = { style: "ignoresChemistry", candidates: 1, temperature: 1 };

// Makes exactly one pick for the team on the clock, using `drafter` (default:
// that team's computer drafter). Lets the UI play computer picks out one by one.
export function pickOnce(state: DraftState, data: GameData, drafter?: Drafter): DraftState {
  const turn = currentTurn(state);
  if (!turn) throw new Error("The draft is already complete");
  const rng = createRng(state.rngState);
  const choice = chooseOption(state, data, drafter ?? drafterFor(state, turn.teamIndex), rng);
  return { ...makePick(state, data, choice.playerId, choice.slot), rngState: rng.state() };
}
