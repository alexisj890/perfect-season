// Turns a lineup (slot → player id) into the numbers the match engine needs.
// Built once per team, then reused for every match.

import type { GameData, Player, SlotId } from "@/lib/data/types";
import { teamChemistry } from "./chemistry";
import { ENGINE } from "./config";
import { positionFit } from "./positionFit";

export type Lineup = Record<SlotId, string>; // slot id → player id

export interface TeamPlayer {
  player: Player;
  slot: SlotId;
  rating: number; // weightedScore × position-fit multiplier
  attackWeight: number; // 0–100, higher for slots further up the pitch
  isKeeperSlot: boolean;
}

export interface TeamProfile {
  players: TeamPlayer[];
  // Both are relative to an average all-time XI (see averageRatings):
  // +5 means five rating points better than average.
  attack: number; // weighted toward forwards
  defence: number; // weighted toward keeper and defenders
  chemistry: number; // total points across all pairs
  chemistryFactor: number; // e.g. 1.03 = +3% strength
}

export function buildTeam(lineup: Lineup, data: GameData): TeamProfile {
  const byId = new Map(data.players.map((p) => [p.id, p]));
  const players = data.formation.slots.map((slot): TeamPlayer => {
    const playerId = lineup[slot.id];
    const player = byId.get(playerId);
    if (!player) throw new Error(`Lineup slot ${slot.id} has unknown player "${playerId}"`);
    return {
      player,
      slot: slot.id,
      rating: player.weightedScore * positionFit(player, slot, data).multiplier,
      // pitch_y runs from 0 (attacking end) to 100 (own goal), so slot position
      // decides how much each player counts toward attack versus defence.
      attackWeight: 100 - slot.pitchY,
      isKeeperSlot: slot.accepts === "GK",
    };
  });
  if (new Set(players.map((p) => p.player.id)).size !== players.length) {
    throw new Error("A player appears in the lineup twice");
  }

  const average = averageRatings(data);

  const chemistry = teamChemistry(
    players.map((p) => p.player),
    data,
  );
  const scaled = Math.max(-1, Math.min(1, chemistry / ENGINE.chemistryForMaxEffect));

  return {
    players,
    attack: attackRating(players) - average.attack,
    defence: defenceRating(players) - average.defence,
    chemistry,
    chemistryFactor: 1 + scaled * ENGINE.chemistryMaxEffect,
  };
}

function weightedAverage(players: TeamPlayer[], weight: (p: TeamPlayer) => number): number {
  return (
    players.reduce((sum, p) => sum + p.rating * weight(p), 0) /
    players.reduce((sum, p) => sum + weight(p), 0)
  );
}

const attackRating = (players: TeamPlayer[]) => weightedAverage(players, (p) => p.attackWeight);
const defenceRating = (players: TeamPlayer[]) => weightedAverage(players, (p) => 100 - p.attackWeight);

// The ratings of an "average all-time XI": every slot filled by a player
// rated at the pool's mean for that slot. Cached per data set.
const averageCache = new WeakMap<GameData, { attack: number; defence: number }>();

function averageRatings(data: GameData): { attack: number; defence: number } {
  const cached = averageCache.get(data);
  if (cached) return cached;
  const players = data.formation.slots.map((slot) => {
    const pool = data.players.filter((p) => p.homeSlot === slot.id);
    const rating =
      pool.reduce((sum, p) => sum + p.weightedScore * positionFit(p, slot, data).multiplier, 0) /
      pool.length;
    return { rating, attackWeight: 100 - slot.pitchY } as TeamPlayer;
  });
  const result = { attack: attackRating(players), defence: defenceRating(players) };
  averageCache.set(data, result);
  return result;
}
