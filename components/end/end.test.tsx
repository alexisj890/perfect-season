// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { RunRecap } from "@/lib/end/recap";
import type { MatchResult } from "@/lib/engine/match";
import type { RunOutcome } from "@/lib/playoffs/outcome";
import type { PlayoffMatch } from "@/lib/playoffs/playoffs";
import { endHeadline } from "./endView";
import { Trophy } from "./Trophy";

afterEach(cleanup);

const result = (homeGoals: number, awayGoals: number, extra: Partial<MatchResult> = {}) =>
  ({ homeGoals, awayGoals, extraTime: false, shootout: null, ...extra }) as MatchResult;

// The final, user (team 0) at "home" on the neutral ground.
const final = (r: MatchResult): PlayoffMatch =>
  ({ key: "final", step: "Final", label: "Final", home: 0, away: 3, result: r, neutral: true, firstLeg: null }) as PlayoffMatch;

function recap(outcome: RunOutcome, overrides: Partial<RunRecap> = {}): RunRecap {
  return {
    outcome,
    user: 0,
    names: ["Alexis FC", "Galácticos", "Moneyball", "Total Football"],
    teamName: "Alexis FC",
    league: { team: 0, played: 30, won: 25, drawn: 3, lost: 2, goalsFor: 80, goalsAgainst: 20, goalDifference: 60, points: 78, position: 2, teams: 16 },
    knockouts: [],
    overall: { won: 30, drawn: 3, lost: 2, played: 35 },
    marks: [],
    championName: "Alexis FC",
    beatenBy: null,
    squad: [],
    playerOfTheSeason: null,
    topScorer: null,
    ...overrides,
  };
}

describe("endHeadline", () => {
  it("crowns a perfect season", () => {
    const h = endHeadline(recap({ kind: "champion", perfect: true, invincible: true }, { knockouts: [final(result(3, 1))], overall: { won: 35, drawn: 0, lost: 0, played: 35 } }));
    expect(h).toMatchObject({ kicker: "Champions", title: "Perfect season", champion: true, honour: "perfect" });
    expect(h.lines).toEqual(["35 matches, 35 wins.", "Won the final 3–1 against Total Football."]);
  });

  it("crowns an invincible season, counting the draws", () => {
    const h = endHeadline(
      recap({ kind: "champion", perfect: false, invincible: true }, { knockouts: [final(result(1, 1, { extraTime: true, shootout: { home: 4, away: 3 }, winner: "home" } as Partial<MatchResult>))], overall: { won: 34, drawn: 1, lost: 0, played: 35 } }),
    );
    expect(h).toMatchObject({ title: "Invincible season", honour: "invincible" });
    expect(h.lines).toEqual(["Unbeaten in all 35: 34 wins and 1 draw.", "Won the final 1–1 against Total Football, 4–3 on penalties."]);
  });

  it("reads the final from the user's side when they were the 'away' team", () => {
    const awayFinal = { ...final(result(2, 3, { extraTime: true })), home: 3, away: 0 };
    const h = endHeadline(recap({ kind: "champion", perfect: false, invincible: false }, { knockouts: [awayFinal] }));
    expect(h).toMatchObject({ title: "Champions", kicker: "2nd in the league", honour: null });
    expect(h.lines[0]).toBe("Won the final 3–2 against Total Football after extra time.");
  });

  it("names who knocked the user out and who won it all", () => {
    const h = endHeadline(recap({ kind: "eliminated", round: "SF" }, { beatenBy: "Galácticos", championName: "Moneyball" }));
    expect(h).toMatchObject({ title: "Better luck next time", champion: false });
    expect(h.lines).toEqual(["Knocked out in the semi-finals by Galácticos.", "Moneyball won the title."]);
  });

  it("calls a lost final runners-up", () => {
    const h = endHeadline(recap({ kind: "eliminated", round: "Final" }, { beatenBy: "Galácticos", championName: "Galácticos" }));
    expect(h).toMatchObject({ kicker: "Runners-up", title: "Better luck next time" });
    expect(h.lines).toEqual(["Lost the final to Galácticos."]);
  });

  it("relegates a team outside the top 8", () => {
    const h = endHeadline(recap({ kind: "relegated", position: 11 }, { league: { ...recap({ kind: "inProgress" }).league, position: 11 }, championName: "Moneyball" }));
    expect(h).toMatchObject({ kicker: "11th of 16", title: "Relegated", champion: false });
    expect(h.lines).toEqual(["Only the top 8 reach the playoffs.", "Moneyball won the title."]);
  });
});

describe("Trophy", () => {
  it("is decorative, solid for a champion and an outline otherwise", () => {
    const { container, rerender } = render(<Trophy won />);
    expect(container.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("g")!.getAttribute("fill")).toBe("currentColor");
    rerender(<Trophy won={false} />);
    expect(container.querySelector("g")!.getAttribute("fill")).toBe("none");
    expect(screen.queryByRole("img")).toBeNull();
  });
});
