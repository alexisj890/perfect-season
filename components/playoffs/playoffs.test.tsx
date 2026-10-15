// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadGameData } from "@/lib/data/load";
import { champion, nextUserMatch, playoffMatches } from "@/lib/playoffs/playoffs";
import { finishDraft, finishSeason, playPlayoffs, runPhase, startPlayoffs, startRun, userTeam } from "@/lib/run";
import { Bracket } from "./Bracket";
import { UpNext } from "./UpNext";
import { YourPath } from "./YourPath";

afterEach(cleanup);

const data = loadGameData();
const run = (() => {
  for (let seed = 1; seed < 60; seed++) {
    const r = startPlayoffs(finishSeason(finishDraft(startRun(data, { id: "t", createdAt: "", seed, difficulty: "easy" }), data), data));
    if (runPhase(r) === "playoffs") return r;
  }
  throw new Error("no qualifying seed");
})();
const me = userTeam(run);
const names = run.draft.teams.map((t) => t.name);

describe("Bracket", () => {
  it("shows the quarter-finals and placeholders before anything is played", () => {
    render(<Bracket state={run.playoffs!} names={names} user={me} />);
    const qf = screen.getByRole("region", { name: "Quarter-finals" });
    expect(within(qf).getAllByLabelText(/^QF \d:/)).toHaveLength(4);
    expect(screen.getByText("Winner QF 1")).toBeTruthy();
    expect(screen.getByText("Winner SF 2")).toBeTruthy();
  });

  it("fills in the semi-finals, the final and the champion as they're played", () => {
    const done = playPlayoffs(run, data, "rest");
    render(<Bracket state={done.playoffs!} names={names} user={me} />);
    expect(within(screen.getByRole("region", { name: "Semi-finals" })).getAllByLabelText(/^SF \d:/)).toHaveLength(2);
    expect(screen.getByLabelText("Final result").textContent).toContain(`🏆 ${names[champion(done.playoffs!)!]}`);
  });
});

describe("UpNext", () => {
  const base = {
    names,
    user: me,
    knockedOutBy: null,
    championName: null,
    userIsChampion: false,
    onPlay: vi.fn(),
    onWatch: vi.fn(),
    onSimRest: vi.fn(),
    onFinish: vi.fn(),
  };

  it("offers Play and Watch for the user's match", () => {
    const props = { ...base, onPlay: vi.fn(), onWatch: vi.fn() };
    render(<UpNext {...props} step="QF leg 1" userMatch={nextUserMatch(run.playoffs!, me)} />);
    expect(screen.getByText(/Quarter-finals · 1st legs/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Play match" }));
    fireEvent.click(screen.getByRole("button", { name: "Watch" }));
    expect(props.onPlay).toHaveBeenCalled();
    expect(props.onWatch).toHaveBeenCalled();
  });

  it("lets a knocked-out player sim the rest or move on", () => {
    const props = { ...base, knockedOutBy: "Moneyball FC", onFinish: vi.fn() };
    render(<UpNext {...props} step="SF leg 1" userMatch={null} />);
    expect(screen.getByText("You were knocked out by Moneyball FC.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Watch" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Skip to season review" }));
    expect(props.onFinish).toHaveBeenCalled();
    // Nothing of the user's left to skip, so no confirmation.
    fireEvent.click(screen.getByRole("button", { name: "Sim to the end" }));
    expect(props.onSimRest).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks before simming past the user's own matches", () => {
    const props = { ...base, onSimRest: vi.fn() };
    render(<UpNext {...props} step="QF leg 1" userMatch={nextUserMatch(run.playoffs!, me)} />);
    fireEvent.click(screen.getByRole("button", { name: "Sim to the end" }));
    const dialog = screen.getByRole("dialog", { name: "Sim the rest of the playoffs?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(props.onSimRest).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Sim to the end" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Sim to the end" }));
    expect(props.onSimRest).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("names the champion once the final is played", () => {
    render(<UpNext {...base} step={null} userMatch={null} championName="Your XI" userIsChampion />);
    expect(screen.getByText("🏆 Your XI")).toBeTruthy();
    expect(screen.getByText("You're the champions!")).toBeTruthy();
  });
});

describe("YourPath", () => {
  it("lists the user's knockout results with replay links", () => {
    const played = playPlayoffs(playPlayoffs(run, data, "step"), data, "step");
    const mine = playoffMatches(played.playoffs!).filter((m) => m.result && (m.home === me || m.away === me));
    render(<YourPath matches={mine} names={names} user={me} />);
    const links = screen.getAllByRole("link", { name: "Replay ›" });
    expect(links.map((l) => l.getAttribute("href"))).toEqual(mine.map((m) => `/match/${m.key}`));
  });
});
