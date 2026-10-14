// How a drafter values its options. Each computer team gets one style, so the
// league ends up uneven — like real managers, some draft better than others.
//
//   balanced          best player for an open slot, counting chemistry with the squad so far
//   ignoresChemistry  best player for an open slot, rating only
//   starChaser        the biggest name left, wherever he fits (even out of position)
//   panicFill         rushes to fill whichever slot is running out of natural options,
//                     reaching for weaker players to do it

import type { GameData, SlotId } from "@/lib/data/types";
import { pairPoints } from "@/lib/engine/chemistry";
import { ENGINE } from "@/lib/engine/config";
import { positionFit, slotRating } from "@/lib/engine/positionFit";
import type { DraftState } from "./draft";
import { availablePlayers, openSlots } from "./draft";

export type DraftStyle = "balanced" | "ignoresChemistry" | "starChaser" | "panicFill";

export interface PickOption {
  playerId: string;
  slot: SlotId;
  rating: number; // weightedScore × fit for that slot
  value: number; // how much this drafter wants it (style-dependent)
}

// Rating points one chemistry point is worth to a team. A chemistry point
// changes expected goals by chemistryMaxEffect / chemistryForMaxEffect; one
// rating point for one of 11 players changes them by about ratingSensitivity / 11.
export function chemistryPointValue(data: GameData): number {
  const perChemistryPoint = ENGINE.chemistryMaxEffect / ENGINE.chemistryForMaxEffect;
  const perRatingPoint = ENGINE.ratingSensitivity / data.formation.slots.length;
  return perChemistryPoint / perRatingPoint;
}

// Each available player once, in the open slot this drafter likes best for him,
// sorted best value first.
export function scoreOptions(state: DraftState, data: GameData, teamIndex: number, style: DraftStyle): PickOption[] {
  const open = openSlots(state, teamIndex, data);
  let slots = data.formation.slots.filter((s) => open.includes(s.id));
  const available = availablePlayers(state, data);

  if (style === "panicFill") {
    // Only look at the slot with the fewest natural options left.
    const naturalsLeft = (slotId: SlotId) => {
      const slot = slots.find((s) => s.id === slotId)!;
      return available.filter((p) => positionFit(p, slot, data).fit === "Natural").length;
    };
    const scarcest = [...open].sort((a, b) => naturalsLeft(a) - naturalsLeft(b))[0];
    slots = slots.filter((s) => s.id === scarcest);
  }

  const byId = new Map(data.players.map((p) => [p.id, p]));
  const squad = state.picks.filter((p) => p.teamIndex === teamIndex).map((p) => byId.get(p.playerId)!);
  const chemistryValue = chemistryPointValue(data);

  return available
    .map((player) => {
      const best = slots
        .map((slot) => ({ slot: slot.id, rating: slotRating(player, slot, data) }))
        .reduce((a, b) => (b.rating > a.rating ? b : a));
      let value = best.rating;
      if (style === "starChaser") value = player.weightedScore; // fit doesn't put him off
      if (style === "balanced") {
        const chemistryGain = squad.reduce((sum, mate) => sum + pairPoints(player, mate, data), 0);
        value += chemistryValue * chemistryGain;
      }
      return { playerId: player.id, slot: best.slot, rating: best.rating, value };
    })
    .sort((a, b) => b.value - a.value);
}
