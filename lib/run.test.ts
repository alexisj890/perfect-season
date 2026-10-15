import { describe, expect, it } from "vitest";
import { loadGameData } from "@/lib/data/load";
import { pickTeamNames, TEAM_NAMES } from "@/lib/draft/names";
import { createRng } from "@/lib/rng";
import { autoDraft } from "@/lib/draft/cpu";
import { currentTurn, isComplete } from "@/lib/draft/draft";
import { nextMatchday } from "@/lib/season/season";
import { isPlayoffsComplete, nextUserMatch, playoffMatches, seedOf } from "@/lib/playoffs/playoffs";
import {
  endRun,
  findUserMatch,
  finishDraft,
  finishPlayoffs,
  finishSeason,
  outcomeOf,
  PHASE_ROUTES,
  playLeague,
  playPlayoffs,
  runPhase,
  runStatusLine,
  runSummary,
  startPlayoffs,
  startRun,
  startSeason,
  userTeam,
  type RunState,
} from "./run";
import { clearRun, loadRun, RUN_STORAGE_KEY, saveRun } from "./storage";

const data = loadGameData();
// Big names anywhere, sloppily: the weak profile from the odds script.
const WEAK_DRAFTER = { style: "starChaser", candidates: 6, temperature: 3 } as const;
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
    // Find a seed where a badly drafted user team misses the top 8 on hard.
    for (let seed = 1; seed < 40; seed++) {
      const base = startRun(data, { id: "x", createdAt: "", seed, difficulty: "hard" });
      const run = finishSeason(startSeason({ ...base, draft: autoDraft(base.draft, data, WEAK_DRAFTER) }), data);
      if (outcomeOf(run).kind === "relegated") {
        expect(runPhase(run)).toBe("finished");
        // The playoffs are still played out, so the end screen can name the champion.
        expect(isPlayoffsComplete(run.playoffs!)).toBe(true);
        expect(run.ended).toBe(true);
        return;
      }
    }
    throw new Error("No relegation found in 40 seeds");
  });

  it("stays on the season screen after the last matchday until the player moves on", () => {
    let run = finishDraft(newRun(7), data);
    run = playLeague(run, data, "matchday");
    expect(nextMatchday(run.season!)).toBe(2);
    run = playLeague(run, data, "rest");
    expect(nextMatchday(run.season!)).toBeNull();
    expect(run.playoffs).toBeNull();
    expect(runPhase(run)).toBe("season");
    expect(runSummary(run)).toBe("Season complete");
    expect(["playoffs", "finished"]).toContain(runPhase(startPlayoffs(run)));
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

describe("playoffs in a run", () => {
  // A run that reached the playoffs (seed chosen so the user qualifies).
  const qualified = (() => {
    for (let seed = 1; seed < 60; seed++) {
      const run = startPlayoffs(finishSeason(finishDraft(newRun(seed), data), data));
      if (runPhase(run) === "playoffs") return run;
    }
    throw new Error("no qualifying seed");
  })();
  const me = userTeam(qualified);

  it("lists every knockout match with a key, label and the right home side", () => {
    const matches = playoffMatches(qualified.playoffs!);
    expect(matches.map((m) => m.key)).toEqual([
      "qf-1-1", "qf-1-2", "qf-2-1", "qf-2-2", "qf-3-1", "qf-3-2", "qf-4-1", "qf-4-2", "final",
    ]);
    const qf1 = qualified.playoffs!.quarterFinals[0];
    expect(matches[0]).toMatchObject({ label: "Quarter-final, 1st leg", home: qf1.lower, away: qf1.higher });
    expect(matches[1]).toMatchObject({ label: "Quarter-final, 2nd leg", home: qf1.higher, away: qf1.lower });
    expect(matches.at(-1)).toMatchObject({ key: "final", neutral: true, home: null });
  });

  it("finds the user's next knockout match and plays one step at a time", () => {
    const next = nextUserMatch(qualified.playoffs!, me)!;
    expect(next.step).toBe("QF leg 1");
    expect([next.home, next.away]).toContain(me);
    const after = playPlayoffs(qualified, data, "step");
    expect(after.playoffs!.quarterFinals.every((t) => t.leg1 && !t.leg2)).toBe(true);
    expect(seedOf(after.playoffs!, me)).toBeGreaterThan(0);
  });

  it("opens replays of the user's knockout matches by key, with the first leg in a second leg's title", () => {
    const run = playPlayoffs(playPlayoffs(qualified, data, "step"), data, "step");
    const mine = playoffMatches(run.playoffs!).filter((m) => m.result && (m.home === me || m.away === me));
    expect(mine).toHaveLength(2);
    const leg2 = findUserMatch(run, data, mine[1].key)!;
    expect(leg2.title).toMatch(/^Quarter-final, 2nd leg \(1st leg: .+ \d+–\d+ .+\)$/);
    expect(leg2.result.aggregate).not.toBeNull();
    const other = playoffMatches(run.playoffs!).find((m) => m.result && m.home !== me && m.away !== me)!;
    expect(findUserMatch(run, data, other.key)).toBeNull(); // not one of the user's
  });

  it("stays on the playoffs screen after the final until the player moves on", () => {
    const done = playPlayoffs(qualified, data, "rest");
    expect(isPlayoffsComplete(done.playoffs!)).toBe(true);
    expect(runPhase(done)).toBe("playoffs");
    expect(runPhase(endRun(done))).toBe("finished");
  });

  it("plays out the rest of the playoffs when a knocked-out player moves on", () => {
    const early = endRun(playPlayoffs(qualified, data, "step"), data);
    expect(isPlayoffsComplete(early.playoffs!)).toBe(true);
    expect(runPhase(early)).toBe("finished");
  });
});
