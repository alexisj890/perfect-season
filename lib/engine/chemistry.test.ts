import { describe, expect, it } from "vitest";
import { loadGameData } from "@/lib/data/load";
import { pairChemistry, teamChemistry } from "./chemistry";

const data = loadGameData();
const player = (id: string) => data.players.find((p) => p.id === id)!;
const pair = (a: string, b: string) => pairChemistry(player(a), player(b), data);

describe("pairChemistry", () => {
  it("stacks the iconic bonus on clubmates", () => {
    expect(pair("xavi-hernandez", "andres-iniesta").points).toBe(3 + 2);
    expect(pair("lionel-messi", "luis-suarez").points).toBe(3 + 2);
  });

  it("counts only the strongest of club and country links", () => {
    // Henry and Seaman overlapped at Arsenal; different countries.
    expect(pair("thierry-henry", "david-seaman")).toEqual({ points: 3, links: ["Clubmates"] });
    // Seaman and Saka: same club and country, but decades apart → 1, not 1 + 1.
    expect(pair("david-seaman", "bukayo-saka").points).toBe(1);
  });

  it("links international teammates from different clubs", () => {
    expect(pair("gianluigi-buffon", "paolo-maldini")).toEqual({
      points: 2,
      links: ["International teammates"],
    });
  });

  it("applies the derby penalty only when there is no other link", () => {
    expect(pair("lionel-messi", "cristiano-ronaldo")).toEqual({
      points: -1,
      links: ["Rivals: El Clásico"],
    });
    // Xavi and Ramos are Clásico rivals but Spain teammates, so no penalty.
    expect(pair("xavi-hernandez", "sergio-ramos").points).toBeGreaterThan(0);
  });

  it("is the same in both directions", () => {
    for (const [a, b] of [
      ["xavi-hernandez", "andres-iniesta"],
      ["lionel-messi", "cristiano-ronaldo"],
      ["david-seaman", "bukayo-saka"],
    ]) {
      expect(pair(a, b)).toEqual(pair(b, a));
    }
  });
});

describe("teamChemistry", () => {
  it("sums all 55 pairs of an XI", () => {
    const barca = data.players.filter((p) => p.club === "Barcelona");
    let manual = 0;
    for (let i = 0; i < barca.length; i++)
      for (let j = i + 1; j < barca.length; j++) manual += pairChemistry(barca[i], barca[j], data).points;
    expect(teamChemistry(barca, data)).toBe(manual);
    expect(manual).toBeGreaterThan(100); // an all-Barça XI is full of links
  });
});
