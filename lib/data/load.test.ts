import { describe, expect, it } from "vitest";
import { loadGameData } from "./load";
import { parseYearSpans, slugify } from "./parse";

const data = loadGameData();
const slotIds = data.formation.slots.map((s) => s.id);
const clubs = [...new Set(data.players.map((p) => p.club))];

describe("parseYearSpans", () => {
  it("splits multiple stints and expands a lone year", () => {
    expect(parseYearSpans("2001–2006; 2010", 2026)).toEqual([
      { start: 2001, end: 2006 },
      { start: 2010, end: 2010 },
    ]);
  });

  it('treats "present" as the given year', () => {
    expect(parseYearSpans("2018–present", 2026)).toEqual([{ start: 2018, end: 2026 }]);
  });

  it("rejects malformed years", () => {
    expect(() => parseYearSpans("20x1–2006", 2026)).toThrow();
  });
});

describe("slugify", () => {
  it("strips accents and punctuation", () => {
    expect(slugify("Cesc Fàbregas")).toBe("cesc-fabregas");
    expect(slugify("N'Golo Kanté")).toBe("n-golo-kante");
  });
});

describe("players", () => {
  it("has 16 clubs × 11 players with unique ids", () => {
    expect(data.players).toHaveLength(176);
    expect(clubs).toHaveLength(16);
    expect(new Set(data.players.map((p) => p.id)).size).toBe(176);
  });

  it("fills every formation slot exactly once per club", () => {
    for (const club of clubs) {
      const slots = data.players.filter((p) => p.club === club).map((p) => p.homeSlot);
      expect(slots.sort(), club).toEqual([...slotIds].sort());
    }
  });

  it("has sane ratings, stints and positions", () => {
    for (const p of data.players) {
      expect(p.weightedScore, p.name).toBeGreaterThan(50);
      expect(p.weightedScore, p.name).toBeLessThanOrEqual(100);
      expect(p.stints.length, p.name).toBeGreaterThan(0);
      expect(p.peak.start, p.name).toBeLessThanOrEqual(p.peak.end);
      expect(p.naturalPositions.length, p.name).toBeGreaterThan(0);
    }
  });

  it("only uses position codes the game knows about", () => {
    const known = new Set([
      ...data.formation.slots.map((s) => s.accepts),
      ...data.similarPositions.flat(),
    ]);
    for (const p of data.players) {
      for (const pos of [...p.naturalPositions, ...p.secondaryPositions]) {
        expect(known.has(pos), `${p.name}: ${pos}`).toBe(true);
      }
    }
  });

  it("parses multi-stint careers", () => {
    const campbell = data.players.find((p) => p.id === "sol-campbell")!;
    expect(campbell.stints).toEqual([
      { start: 2001, end: 2006 },
      { start: 2010, end: 2010 },
    ]);
  });
});

describe("formation", () => {
  it("has 11 unique slots on the pitch", () => {
    expect(new Set(slotIds).size).toBe(11);
    for (const s of data.formation.slots) {
      expect(s.pitchX).toBeGreaterThanOrEqual(0);
      expect(s.pitchX).toBeLessThanOrEqual(100);
      expect(s.pitchY).toBeGreaterThanOrEqual(0);
      expect(s.pitchY).toBeLessThanOrEqual(100);
    }
  });

  it("only links real slots, with no duplicates", () => {
    const seen = new Set<string>();
    for (const [a, b] of data.formation.links) {
      expect(slotIds).toContain(a);
      expect(slotIds).toContain(b);
      const key = [a, b].sort().join("-");
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
  });
});

describe("position fit", () => {
  it("has all five tiers, from best to worst", () => {
    expect(data.fitTiers.map((t) => t.fit)).toEqual([
      "Natural",
      "Secondary",
      "Similar",
      "Out of position",
      "Goalkeeper swap",
    ]);
    const multipliers = data.fitTiers.map((t) => t.multiplier);
    expect(multipliers).toEqual([...multipliers].sort((a, b) => b - a));
  });

  it("never treats goalkeeper as similar to an outfield position", () => {
    expect(data.similarPositions.flat()).not.toContain("GK");
  });
});

describe("chemistry, pairs and rivalries", () => {
  it("reads the point values from chemistry_rules.csv", () => {
    expect(data.chemistry).toEqual({
      clubmates: 3,
      internationalTeammates: 2,
      iconicBonus: 2,
      sameClubDifferentEra: 1,
      sameNationalityDifferentEra: 1,
      derbyRivals: -1,
      noLink: 0,
    });
  });

  it("resolves every iconic pair to two different players", () => {
    expect(data.iconicPairs).toHaveLength(70);
    for (const pair of data.iconicPairs) {
      expect(pair.playerA).not.toBe(pair.playerB);
    }
  });

  it("only names clubs that are in the pool", () => {
    for (const r of data.rivalries) {
      expect(clubs, r.name).toContain(r.clubA);
      expect(clubs, r.name).toContain(r.clubB);
    }
  });
});
