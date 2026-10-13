import { describe, expect, it } from "vitest";
import { createRng, poisson, randomInt, weightedPick } from "./rng";

describe("createRng", () => {
  it("repeats exactly for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it("differs for different seeds", () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it("can resume from a saved state", () => {
    const rng = createRng(7);
    rng.next();
    const resumed = createRng(rng.state());
    expect(resumed.next()).toBe(rng.next());
  });

  it("stays within [0, 1)", () => {
    const rng = createRng(3);
    for (let i = 0; i < 10_000; i++) {
      const x = rng.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe("helpers", () => {
  it("randomInt covers the whole inclusive range", () => {
    const rng = createRng(5);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(randomInt(rng, 1, 6));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("poisson averages its mean", () => {
    const rng = createRng(9);
    let total = 0;
    for (let i = 0; i < 20_000; i++) total += poisson(rng, 1.4);
    expect(total / 20_000).toBeCloseTo(1.4, 1);
  });

  it("weightedPick follows the weights", () => {
    const rng = createRng(11);
    let heavy = 0;
    for (let i = 0; i < 10_000; i++) {
      if (weightedPick(rng, ["heavy", "light"], (x) => (x === "heavy" ? 3 : 1)) === "heavy") heavy++;
    }
    expect(heavy / 10_000).toBeCloseTo(0.75, 1);
  });
});
