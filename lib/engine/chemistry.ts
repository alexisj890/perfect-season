// Chemistry between players, using chemistry_rules.csv, iconic_pairs.csv and
// rivalries.csv. Every pair in the XI counts (55 pairs), FIFA-style.
//
// Per pair: take the single strongest link (clubmates, international
// teammates, same club / different era, same nationality / different era),
// then add the iconic-partnership bonus on top. The derby penalty applies only
// when the pair has no other link.

import type { GameData, Player, YearSpan } from "@/lib/data/types";

export interface PairChemistry {
  points: number;
  links: string[]; // human-readable reasons, for the UI
}

function overlaps(a: YearSpan[], b: YearSpan[]): boolean {
  return a.some((x) => b.some((y) => x.start <= y.end && y.start <= x.end));
}

export function pairChemistry(a: Player, b: Player, data: GameData): PairChemistry {
  const rules = data.chemistry;
  const candidates: { points: number; link: string }[] = [];

  if (a.club === b.club) {
    candidates.push(
      overlaps(a.stints, b.stints)
        ? { points: rules.clubmates, link: "Clubmates" }
        : { points: rules.sameClubDifferentEra, link: "Same club, different era" },
    );
  }
  if (a.nationality === b.nationality) {
    candidates.push(
      overlaps([a.peak], [b.peak])
        ? { points: rules.internationalTeammates, link: "International teammates" }
        : { points: rules.sameNationalityDifferentEra, link: "Same nationality, different era" },
    );
  }

  const best = candidates.sort((x, y) => y.points - x.points)[0];
  let points = best?.points ?? rules.noLink;
  const links = best ? [best.link] : [];

  const iconic = data.iconicPairs.find(
    (p) => (p.playerA === a.id && p.playerB === b.id) || (p.playerA === b.id && p.playerB === a.id),
  );
  if (iconic) {
    points += iconic.bonusPoints;
    links.push(`Iconic partnership: ${iconic.context}`);
  }

  if (links.length === 0) {
    const rivalry = data.rivalries.find(
      (r) => (r.clubA === a.club && r.clubB === b.club) || (r.clubA === b.club && r.clubB === a.club),
    );
    if (rivalry) {
      points += rivalry.penalty;
      links.push(`Rivals: ${rivalry.name}`);
    }
  }

  return { points, links };
}

// Sum of pair chemistry across every pair in the team.
export function teamChemistry(players: Player[], data: GameData): number {
  let total = 0;
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      total += pairChemistry(players[i], players[j], data).points;
    }
  }
  return total;
}

// Cached pair points, for code that asks the same question many times (the draft).
const pairCache = new WeakMap<GameData, Map<string, number>>();

export function pairPoints(a: Player, b: Player, data: GameData): number {
  let cache = pairCache.get(data);
  if (!cache) {
    cache = new Map();
    pairCache.set(data, cache);
  }
  const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
  let points = cache.get(key);
  if (points === undefined) {
    points = pairChemistry(a, b, data).points;
    cache.set(key, points);
  }
  return points;
}
