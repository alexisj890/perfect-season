import { describe, expect, it } from "vitest";
import { loadGameData } from "@/lib/data/load";
import { ENGINE } from "./config";
import { buildTeam } from "./team";
import { clubLineup, lineupByRank } from "./testTeams";

const data = loadGameData();

describe("buildTeam", () => {
  it("rates teams relative to an average XI", () => {
    const strong = buildTeam(lineupByRank(data, [1, 2]), data);
    const average = buildTeam(lineupByRank(data, [7, 8]), data);
    const weak = buildTeam(lineupByRank(data, [14, 15]), data);
    expect(Math.abs(average.attack)).toBeLessThan(2);
    expect(Math.abs(average.defence)).toBeLessThan(2);
    expect(strong.attack).toBeGreaterThan(average.attack);
    expect(strong.defence).toBeGreaterThan(average.defence);
    expect(weak.attack).toBeLessThan(average.attack);
  });

  it("caps the chemistry effect", () => {
    const barca = buildTeam(clubLineup(data, "Barcelona"), data);
    expect(barca.chemistry).toBeGreaterThan(ENGINE.chemistryForMaxEffect);
    expect(barca.chemistryFactor).toBeCloseTo(1 + ENGINE.chemistryMaxEffect);
  });

  it("punishes an outfield player in goal", () => {
    const lineup = clubLineup(data, "Barcelona");
    const normal = buildTeam(lineup, data);
    const swapped = buildTeam({ ...lineup, GK: lineup.ST, ST: lineup.GK }, data);
    expect(swapped.defence).toBeLessThan(normal.defence - 5);
  });

  it("rejects unknown and duplicate players", () => {
    const lineup = clubLineup(data, "Arsenal");
    expect(() => buildTeam({ ...lineup, ST: "nobody" }, data)).toThrow(/unknown player/);
    expect(() => buildTeam({ ...lineup, LW: lineup.ST }, data)).toThrow(/twice/);
  });
});
