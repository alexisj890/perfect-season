// Seeded random numbers (mulberry32). The same seed always produces the same
// sequence, so a whole run can be replayed, tested, and saved as a single number.

export interface Rng {
  next(): number; // float in [0, 1)
  state(): number; // save this to resume the sequence later
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  return {
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    state: () => s,
  };
}

// Integer in [min, max], inclusive.
export function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng.next() * (max - min + 1));
}

// Picks one item, with chance proportional to its weight.
export function weightedPick<T>(rng: Rng, items: T[], weight: (item: T) => number): T {
  const weights = items.map(weight);
  const total = weights.reduce((a, b) => a + b, 0);
  if (items.length === 0 || total <= 0) throw new Error("weightedPick needs a positive total weight");
  let roll = rng.next() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll < 0) return items[i];
  }
  return items[items.length - 1];
}

// Number of events in a period when `mean` are expected (Knuth's method).
export function poisson(rng: Rng, mean: number): number {
  const limit = Math.exp(-mean);
  let count = 0;
  let product = rng.next();
  while (product > limit) {
    count++;
    product *= rng.next();
  }
  return count;
}
