// Helpers for tests: build lineups from the pool by rating rank.
// Rank 0 = best player at that slot, 15 = worst.

import type { GameData } from "@/lib/data/types";
import type { Lineup } from "./team";

// `ranks` cycles across the slots, so [1, 2] alternates 2nd- and 3rd-best.
export function lineupByRank(data: GameData, ranks: number[]): Lineup {
  return Object.fromEntries(
    data.formation.slots.map((slot, i) => {
      const pool = data.players
        .filter((p) => p.homeSlot === slot.id)
        .sort((a, b) => b.weightedScore - a.weightedScore);
      return [slot.id, pool[ranks[i % ranks.length]].id];
    }),
  );
}

export function clubLineup(data: GameData, club: string): Lineup {
  return Object.fromEntries(
    data.players.filter((p) => p.club === club).map((p) => [p.homeSlot, p.id]),
  );
}
