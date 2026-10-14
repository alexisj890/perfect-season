// The league fixture list: a double round-robin. Every team plays every other
// team twice, once at home and once away. Matchdays 1–15 use the circle
// method; matchdays 16–30 repeat them with home and away swapped.

import { createRng, randomInt } from "@/lib/rng";

export interface Fixture {
  matchday: number; // 1-based
  home: number; // team index
  away: number;
}

export function createFixtures(teamCount: number, seed: number): Fixture[] {
  if (teamCount % 2 !== 0) throw new Error("The circle method needs an even number of teams");

  // Shuffle the team order so each run gets a different schedule.
  const rng = createRng(seed);
  const order = Array.from({ length: teamCount }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = randomInt(rng, 0, i);
    [order[i], order[j]] = [order[j], order[i]];
  }

  const rounds = teamCount - 1;
  const firstHalf: Fixture[] = [];
  // Circle method: order[0] stays put, everyone else rotates one place per round.
  const ring = order.slice(1);
  for (let round = 0; round < rounds; round++) {
    const positions = [order[0], ...ring];
    for (let i = 0; i < teamCount / 2; i++) {
      const a = positions[i];
      const b = positions[teamCount - 1 - i];
      // Flip who hosts every round, so teams alternate home and away (with an
      // occasional two-in-a-row as a team crosses to the other side of the circle).
      const aHome = round % 2 === 0;
      firstHalf.push({ matchday: round + 1, home: aHome ? a : b, away: aHome ? b : a });
    }
    ring.unshift(ring.pop()!);
  }

  const secondHalf = firstHalf.map((f) => ({ matchday: f.matchday + rounds, home: f.away, away: f.home }));
  return [...firstHalf, ...secondHalf];
}

// Longest run of consecutive home (or away) games for a team.
export function longestVenueRun(fixtures: Fixture[], team: number): number {
  const venues = fixtures
    .filter((f) => f.home === team || f.away === team)
    .sort((a, b) => a.matchday - b.matchday)
    .map((f) => f.home === team);
  let longest = 0;
  let run = 0;
  venues.forEach((home, i) => {
    run = i > 0 && home === venues[i - 1] ? run + 1 : 1;
    longest = Math.max(longest, run);
  });
  return longest;
}
