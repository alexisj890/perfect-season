import { describe, expect, it } from "vitest";
import { loadGameData } from "@/lib/data/load";
import { pickTeamNames, TEAM_NAMES } from "@/lib/draft/names";
import { createRng } from "@/lib/rng";
import { autoDraft } from "@/lib/draft/cpu";
import { currentTurn, isComplete } from "@/lib/draft/draft";
import { nextMatchday } from "@/lib/season/season";
import {
  finishDraft,
  finishPlayoffs,
  finishSeason,
  outcomeOf,
  PHASE_ROUTES,
  runPhase,
  runStatusLine,
  startPlayoffs,
  startRun,
  startSeason,
  userTeam,
  type RunState,
} from "./run";
import { clearRun, loadRun, RUN_STORAGE_KEY, saveRun } from "./storage";

const data = loadGameData();
const newRun = (seed = 1) =>
  startRun(data, { id: "test", createdAt: "2026-01-01T00:00:00.000Z", seed, difficulty: "normal", userName: "Alexis FC" });

describe("startRun", () => {
  const run = newRun();

  it("starts in the draft with the computer teams ahead of the user already picked", () => {
    expect(runPhase(run)).toBe("draft");
    expect(currentTurn(run.draft)!.teamIndex).toBe(userTeam(run));
    expect(run.draft.picks).toHaveLength(userTeam(run));
    expect(run.season).toBeNull();
    expect(run.userId).toBeNull();
  });

  it("uses the user's team name and style-based names for computer teams", () => {
    expect(run.draft.teams[userTeam(run)].name).toBe("Alexis FC");
    const names = run.draft.teams.map((t) => t.name);
    expect(new Set(names).size).toBe(16);
    for (const team of run.draft.teams) {
      if (!team.isUser) expect(TEAM_NAMES[team.style!]).toContain(team.name);
    }
  });

  it("borrows names from other styles rather than numbering them when one style runs out", () => {
    const styles = Array.from({ length: 15 }, () => "starChaser" as const);
    const names = pickTeamNames(styles, createRng(1));
    expect(new Set(names).size).toBe(15);
    expect(names.every((n) => !/\d/.test(n))).toBe(true);
    expect(names.filter((n) => TEAM_NAMES.starChaser.includes(n))).toHaveLength(TEAM_NAMES.starChaser.length);
  });
});

describe("phases", () => {
  it("moves draft → season → playoffs → finished", () => {
    let run = newRun(2);
    expect(runPhase(run)).toBe("draft");
    run = finishDraft(run, data);
    expect(isComplete(run.draft)).toBe(true);
    expect(runPhase(run)).toBe("season");
    expect(nextMatchday(run.season!)).toBe(1);
    run = finishSeason(run, data);
    expect(["playoffs", "finished"]).toContain(runPhase(run));
    run = finishPlayoffs(run, data);
    expect(runPhase(run)).toBe("finished");
    expect(outcomeOf(run).kind).not.toBe("inProgress");
  });

  it("finishes straight after the season when the user is relegated", () => {
    // Find a seed where the auto-drafted user team misses the top 8 on hard.
    for (let seed = 1; seed < 40; seed++) {
      const base = startRun(data, { id: "x", createdAt: "", seed, difficulty: "hard" });
      const run = finishSeason(finishDraft(base, data), data);
      if (outcomeOf(run).kind === "relegated") {
        expect(runPhase(run)).toBe("finished");
        return;
      }
    }
    throw new Error("No relegation found in 40 seeds");
  });

  it("refuses to start a phase early", () => {
    const run = newRun(3);
    expect(() => startSeason(run)).toThrow(/draft/);
    expect(() => startPlayoffs(finishDraft(run, data))).toThrow(/season/);
  });

  it("describes where the run is for the Continue button", () => {
    const run = newRun(5);
    expect(runStatusLine(run)).toBe(`Normal · Pick ${run.draft.picks.length + 1} of 176`);
    const drafted = { ...run, draft: autoDraft(run.draft, data) };
    expect(runStatusLine(drafted)).toBe("Normal · Draft complete");
    const midSeason = finishDraft(run, data);
    expect(runStatusLine(midSeason)).toBe("Normal · Matchday 0 of 30 · 0W 0D 0L");
  });

  it("maps every phase to a screen", () => {
    expect(PHASE_ROUTES).toEqual({ draft: "/draft", season: "/season", playoffs: "/playoffs", finished: "/end" });
  });
});

describe("storage", () => {
  // A stand-in for the browser's localStorage, so these tests run in Node.
  function memoryStorage(): Storage {
    const items = new Map<string, string>();
    return {
      getItem: (k) => items.get(k) ?? null,
      setItem: (k, v) => void items.set(k, v),
      removeItem: (k) => void items.delete(k),
      clear: () => items.clear(),
      key: (i) => [...items.keys()][i] ?? null,
      get length() {
        return items.size;
      },
    };
  }

  it("saves, loads and clears a run", () => {
    const storage = memoryStorage();
    const run = finishDraft(newRun(4), data);
    expect(loadRun(storage)).toBeNull();
    saveRun(run, storage);
    expect(loadRun(storage)).toEqual(run);
    clearRun(storage);
    expect(loadRun(storage)).toBeNull();
  });

  it("ignores corrupted saves and saves from another version", () => {
    const storage = memoryStorage();
    storage.setItem(RUN_STORAGE_KEY, "{not json");
    expect(loadRun(storage)).toBeNull();
    storage.setItem(RUN_STORAGE_KEY, JSON.stringify({ ...newRun(), version: 999 } as unknown as RunState));
    expect(loadRun(storage)).toBeNull();
  });
});
