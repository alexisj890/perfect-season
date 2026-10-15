// Ready-made lineups, for tests, scripts and (later) computer-drafted teams.

import type { GameData } from "@/lib/data/types";
import type { Lineup } from "./team";

// Each slot gets the club-XI player of the given rating rank at that slot
// (0 = best, 15 = worst; pool-only extras are left out). `ranks` cycles across the slots, so [1, 2] alternates 2nd- and 3rd-best.
export function lineupByRank(data: GameData, ranks: number[]): Lineup {
  return Object.fromEntries(
    data.formation.slots.map((slot, i) => {
      const pool = data.players
        .filter((p) => p.homeSlot === slot.id && !p.poolOnly)
        .sort((a, b) => b.weightedScore - a.weightedScore);
      return [slot.id, pool[ranks[i % ranks.length]].id];
    }),
  );
}

// A club's all-time XI, every player in their home slot.
export function clubLineup(data: GameData, club: string): Lineup {
  return Object.fromEntries(
    data.players.filter((p) => p.club === club && !p.poolOnly).map((p) => [p.homeSlot, p.id]),
  );
}
