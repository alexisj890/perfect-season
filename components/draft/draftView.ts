// Plain helpers for the draft room (no React): filtering the pool, fit and
// chemistry for a selected player, and labels. Kept separate so they're testable.

import type { FormationSlot, GameData, Player, SlotId } from "@/lib/data/types";
import { pairChemistry } from "@/lib/engine/chemistry";
import { positionFit } from "@/lib/engine/positionFit";
import type { DraftPick, DraftTeam } from "@/lib/draft/draft";

export type PositionGroup = "GK" | "DEF" | "MID" | "FWD";

const GROUP_OF: Record<string, PositionGroup> = {
  GK: "GK",
  RB: "DEF",
  CB: "DEF",
  LB: "DEF",
  DM: "MID",
  CM: "MID",
  AM: "MID",
  LM: "MID",
  RW: "FWD",
  ST: "FWD",
  LW: "FWD",
  SS: "FWD",
};

// A player's group, from his main (first) natural position.
export function groupOf(player: Player): PositionGroup {
  return GROUP_OF[player.naturalPositions[0]] ?? "MID";
}

// Ratings are shown as whole numbers.
export function displayRating(rating: number): number {
  return Math.round(rating);
}

const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export interface PoolFilter {
  search: string;
  group: PositionGroup | "ALL";
  club: string | "ALL";
}

// Players matching the filter, best rated first. Search ignores accents
// ("fabregas" finds Fàbregas) and matches names and clubs.
export function filterPool(players: Player[], filter: PoolFilter): Player[] {
  const query = fold(filter.search.trim());
  return players
    .filter((p) => filter.group === "ALL" || groupOf(p) === filter.group)
    .filter((p) => filter.club === "ALL" || p.club === filter.club)
    .filter((p) => !query || fold(p.name).includes(query) || fold(p.club).includes(query))
    .sort((a, b) => b.weightedScore - a.weightedScore);
}

export interface SlotOption {
  slot: SlotId;
  fit: string;
  rating: number; // rating in that slot (weightedScore × fit)
}

// How well `player` would fit each of the open slots, best first.
export function slotOptions(player: Player, open: FormationSlot[], data: GameData): SlotOption[] {
  return open
    .map((slot) => {
      const fit = positionFit(player, slot, data);
      return { slot: slot.id, fit: fit.fit, rating: player.weightedScore * fit.multiplier };
    })
    .sort((a, b) => b.rating - a.rating);
}

export interface ChemistryLink {
  mate: Player;
  points: number;
  links: string[];
}

// The chemistry `player` would add with each player already in the squad.
export function chemistryWithSquad(player: Player, squad: Player[], data: GameData): { total: number; links: ChemistryLink[] } {
  const links = squad
    .map((mate) => ({ mate, ...pairChemistry(player, mate, data) }))
    .filter((l) => l.points !== 0)
    .sort((a, b) => b.points - a.points);
  return { total: links.reduce((sum, l) => sum + l.points, 0), links };
}

// "Moneyball FC took Diego Maradona (CAM)"
export function pickLabel(pick: DraftPick, teams: DraftTeam[], playersById: Map<string, Player>): string {
  return `${teams[pick.teamIndex].name} took ${playersById.get(pick.playerId)?.name ?? pick.playerId} (${pick.slot})`;
}

export function surname(name: string): string {
  const parts = name.split(" ");
  return parts.length > 1 ? parts.slice(1).join(" ") : name;
}

// Colours for each fit tier (readable in both themes). `short` fits under a
// slot on a small pitch, where neighbouring labels would otherwise collide.
export const FIT_STYLE: Record<string, { label: string; short: string; className: string }> = {
  Natural: { label: "Natural", short: "Natural", className: "border-emerald-500 text-emerald-500" },
  Secondary: { label: "Secondary", short: "Secondary", className: "border-sky-500 text-sky-500" },
  Similar: { label: "Similar", short: "Similar", className: "border-amber-500 text-amber-500" },
  "Out of position": { label: "Out of position", short: "Out of pos.", className: "border-orange-500 text-orange-500" },
  "Goalkeeper swap": { label: "Keeper swap", short: "Keeper swap", className: "border-red-500 text-red-500" },
};
