// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadGameData } from "@/lib/data/load";
import { finishDraft, playLeague, startRun, userTeam } from "@/lib/run";
import { leagueTable, topScorers } from "@/lib/season/season";
import { PerfectTracker } from "@/components/PerfectTracker";
import { MatchRatingsModal } from "@/components/ratings/MatchRatingsModal";
import { buildTeam } from "@/lib/engine/team";
import { lineupOf } from "@/lib/draft/draft";
import { matchRatings, seasonPlayerStats } from "@/lib/engine/ratings";
import { leagueMatchKey, matchesOf } from "@/lib/season/season";
import type { MatchResult } from "@/lib/engine/match";
import { LastResultCard, timeline } from "./LastResultCard";
import { LeagueTable } from "./LeagueTable";
import { NextMatchCard } from "./NextMatchCard";
import { formOf, matchesOn } from "./seasonView";
import { SidePanel } from "./SidePanel";

afterEach(cleanup);

const data = loadGameData();
const playersById = new Map(data.players.map((p) => [p.id, p]));
let run = finishDraft(startRun(data, { id: "t", createdAt: "", seed: 11, difficulty: "normal" }), data);
for (let i = 0; i < 3; i++) run = playLeague(run, data, "matchday");
const season = run.season!;
const me = userTeam(run);
const names = run.draft.teams.map((t) => t.name);

describe("PerfectTracker", () => {
  it("describes progress for screen readers", () => {
    render(<PerfectTracker marks={["win", "win", "dropped", ...Array(32).fill("upcoming")]} />);
    expect(screen.getByRole("img", { name: "Perfect season: 2 of 35 won" })).toBeTruthy();
  });
});

describe("LeagueTable", () => {
  it("lists all 16 teams, highlights the user and marks the playoff line", () => {
    render(<LeagueTable rows={leagueTable(season)} names={names} user={me} playoffPlaces={8} formOf={(t) => formOf(season, t)} />);
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(16);
    expect(rows.find((r) => r.textContent!.includes(names[me]))!.className).toMatch(/bg-accent/);
    expect(rows[7].className).toMatch(/border-dashed/);
    expect(rows[8].className).not.toMatch(/border-dashed/);
  });
});

describe("NextMatchCard", () => {
  it("plays the match, or plays it and opens the replay", () => {
    const onPlay = vi.fn();
    const line = { name: "A", position: 1, rating: 90, form: [], isUser: true };
    const onWatch = vi.fn();
    render(<NextMatchCard matchday={4} home={line} away={{ ...line, name: "B", isUser: false }} onPlay={onPlay} onWatch={onWatch} />);
    fireEvent.click(screen.getByRole("button", { name: "Play match" }));
    expect(onPlay).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Watch" }));
    expect(onWatch).toHaveBeenCalled();
    expect(screen.getByText("Home")).toBeTruthy();
  });
});

describe("SidePanel", () => {
  it("shows the latest matchday and lets you step back through earlier ones", () => {
    render(
      <SidePanel
        latestMatchday={3}
        matchesOn={(d) => matchesOn(season, d)}
        scorers={topScorers(season)}
        names={names}
        user={me}
        playersById={playersById}
        squad={[]}
      />,
    );
    expect(screen.getByText("Matchday 3")).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "Matchday 3 results" })).getAllByRole("listitem")).toHaveLength(8);
    fireEvent.click(screen.getByRole("button", { name: "Previous matchday" }));
    expect(screen.getByText("Matchday 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Scorers" }));
    expect(screen.getByRole("list", { name: "Top scorers" })).toBeTruthy();
  });
});

describe("LastResultCard", () => {
  it("puts each goal on its team's side with the running score", () => {
    const last = season.matches.filter((m) => m.result && (m.home === me || m.away === me)).at(-1)!;
    const result = last.result!;
    render(
      <LastResultCard
        matchday={last.matchday}
        homeName={names[last.home]}
        awayName={names[last.away]}
        userSide={last.home === me ? "home" : "away"}
        result={result}
        outcome="W"
        playersById={playersById}
        onOpenRatings={() => {}}
      />,
    );
    const goals = within(screen.getByRole("list", { name: "Goals" })).getAllByRole("listitem");
    const goalRows = goals.filter((li) => /goal for/.test(li.getAttribute("aria-label") ?? ""));
    expect(goalRows).toHaveLength(result.homeGoals + result.awayGoals);
    for (const row of goalRows) {
      const [homeCell, , awayCell] = [...row.children];
      const scoredByHome = row.getAttribute("aria-label")!.includes(`goal for ${names[last.home]}`);
      expect((scoredByHome ? homeCell : awayCell).textContent).not.toBe("");
      expect((scoredByHome ? awayCell : homeCell).textContent).toBe("");
    }
    expect(goals.at(-1)!.textContent).toMatch(new RegExp(`FT ${result.homeGoals}–${result.awayGoals}`));
  });
});

describe("timeline", () => {
  it("adds HT and FT markers with the running score", () => {
    const fake = {
      ...season.matches[0].result!,
      homeGoals: 2,
      awayGoals: 1,
      extraTime: false,
      events: [
        { type: "shot", minute: 10, addedTime: 0, side: "home", source: "open play", shooterId: "a", assistId: null, outcome: "goal" },
        { type: "shot", minute: 50, addedTime: 0, side: "away", source: "open play", shooterId: "b", assistId: null, outcome: "goal" },
        { type: "shot", minute: 90, addedTime: 3, side: "home", source: "penalty", shooterId: "c", assistId: null, outcome: "goal" },
      ],
    } as MatchResult;
    const rows = timeline(fake).map((r) => (r.kind === "marker" ? `${r.label} ${r.home}-${r.away}` : `goal ${r.home}-${r.away}`));
    expect(rows).toEqual(["goal 1-0", "HT 1-0", "goal 1-1", "goal 2-1", "FT 2-1"]);
  });
});

describe("player ratings", () => {
  const profiles = run.draft.teams.map((_, i) => buildTeam(lineupOf(run.draft, i), data));
  const mine = matchesOf(season, me).filter((m) => m.result);
  const last = mine.at(-1)!;
  const ratings = matchRatings(last.result!, profiles[last.home], profiles[last.away], leagueMatchKey(last));

  it("opens from a click anywhere on the last result card, or its button", () => {
    const onOpen = vi.fn();
    render(
      <LastResultCard
        matchday={last.matchday}
        homeName={names[last.home]}
        awayName={names[last.away]}
        userSide={last.home === me ? "home" : "away"}
        result={last.result!}
        outcome="W"
        playersById={playersById}
        onOpenRatings={onOpen}
      />,
    );
    fireEvent.click(screen.getByRole("region", { name: "Last result" }));
    fireEvent.click(screen.getByRole("button", { name: "Player ratings ›" }));
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("shows both line-ups rated, with one Man of the Match", () => {
    render(
      <MatchRatingsModal
        open
        onClose={() => {}}
        title="Matchday 3"
        homeName={names[last.home]}
        awayName={names[last.away]}
        userSide={last.home === me ? "home" : "away"}
        result={last.result!}
        ratings={ratings}
        slots={data.formation.slots}
        playersById={playersById}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Player ratings · Matchday 3" });
    for (const name of [names[last.home], names[last.away]]) {
      expect(within(dialog).getByRole("region", { name: `${name} ratings` }).querySelectorAll("li")).toHaveLength(11);
    }
    expect(within(dialog).getByText(/Man of the Match:/).textContent).toContain(playersById.get(ratings.motm)!.name);
  });

  it("lists the user's squad with season averages in the Squad tab", () => {
    const squad = seasonPlayerStats(
      profiles[me],
      mine.map((m) => ({
        ratings: matchRatings(m.result!, profiles[m.home], profiles[m.away], leagueMatchKey(m)),
        side: m.home === me ? ("home" as const) : ("away" as const),
      })),
    );
    render(
      <SidePanel latestMatchday={3} matchesOn={(d) => matchesOn(season, d)} scorers={[]} names={names} user={me} playersById={playersById} squad={squad} />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Squad" }));
    expect(within(screen.getByRole("list", { name: "Squad season ratings" })).getAllByRole("listitem")).toHaveLength(11);
    expect(screen.getByText(/3 matches/)).toBeTruthy();
  });
});
