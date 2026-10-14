import { describe, expect, it } from "vitest";
import { loadGameData } from "@/lib/data/load";
import { positionFit, slotRating } from "./positionFit";

const data = loadGameData();
const player = (id: string) => data.players.find((p) => p.id === id)!;
const slot = (id: string) => data.formation.slots.find((s) => s.id === id)!;
const fit = (playerId: string, slotId: string) => positionFit(player(playerId), slot(slotId), data).fit;

describe("positionFit", () => {
  it("rates almost every player Natural in their home slot", () => {
    const notNatural = data.players
      .filter((p) => positionFit(p, slot(p.homeSlot), data).fit !== "Natural")
      .map((p) => `${p.name}: ${positionFit(p, slot(p.homeSlot), data).fit}`)
      .sort();
    // Matches the position_fit column in players.csv, except Shevchenko, who
    // moves from "Out of position" to the new "Similar" tier (ST → LW).
    expect(notNatural).toEqual([
      "Andriy Shevchenko: Similar",
      "Antoine Griezmann: Secondary",
      "Gianfranco Zola: Secondary",
      "Ruud Gullit: Secondary",
      "Sandro Mazzola: Secondary",
    ]);
  });

  it("covers every tier", () => {
    expect(fit("xavi-hernandez", "CM")).toBe("Natural");
    expect(fit("lionel-messi", "CAM")).toBe("Secondary"); // AM is a secondary position
    expect(fit("xavi-hernandez", "CDM")).toBe("Similar"); // CM ~ DM
    expect(fit("xavi-hernandez", "ST")).toBe("Out of position");
    expect(fit("xavi-hernandez", "GK")).toBe("Goalkeeper swap");
    expect(fit("david-seaman", "ST")).toBe("Goalkeeper swap");
  });

  it("uses weightedScore, not the CSV's effective_rating", () => {
    // Shevchenko's CSV effective_rating is 75.97 (as a LW). At ST he is natural.
    const similar = data.fitTiers.find((t) => t.fit === "Similar")!.multiplier;
    expect(slotRating(player("andriy-shevchenko"), slot("ST"), data)).toBe(92.65);
    expect(slotRating(player("andriy-shevchenko"), slot("LW"), data)).toBeCloseTo(92.65 * similar);
  });
});
