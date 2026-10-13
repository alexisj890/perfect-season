// How well a player suits a slot, using the tiers in position_fit.csv.

import type { FormationSlot, GameData, Player } from "@/lib/data/types";

export interface Fit {
  fit: string;
  multiplier: number;
}

function tier(data: GameData, name: string): Fit {
  const found = data.fitTiers.find((t) => t.fit === name);
  if (!found) throw new Error(`position_fit.csv is missing the "${name}" tier`);
  return found;
}

function areSimilar(data: GameData, a: string, b: string): boolean {
  return data.similarPositions.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

export function positionFit(player: Player, slot: FormationSlot, data: GameData): Fit {
  const family = slot.accepts;
  const isKeeper = player.naturalPositions.includes("GK");
  if ((family === "GK") !== isKeeper) return tier(data, "Goalkeeper swap");
  if (player.naturalPositions.includes(family)) return tier(data, "Natural");
  if (player.secondaryPositions.includes(family)) return tier(data, "Secondary");
  const known = [...player.naturalPositions, ...player.secondaryPositions];
  if (known.some((pos) => areSimilar(data, pos, family))) return tier(data, "Similar");
  return tier(data, "Out of position");
}

export function slotRating(player: Player, slot: FormationSlot, data: GameData): number {
  return player.weightedScore * positionFit(player, slot, data).multiplier;
}
