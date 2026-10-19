import { describe, expect, it } from "vitest";
import { loadGameData } from "@/lib/data/load";
import { finishDraft, finishPlayoffs, finishSeason, playLeague, startRun } from "@/lib/run";
import { reconcile, runProgress } from "./sync";

const data = loadGameData();
const drafting = startRun(data, { id: "run-a", createdAt: "", seed: 5, difficulty: "easy" });
const inSeason = playLeague(finishDraft(drafting, data), data, "matchday");
const other = { ...drafting, id: "run-b" };

describe("runProgress", () => {
  it("only grows as a run moves on", () => {
    const later = playLeague(inSeason, data, "matchday");
    const done = finishPlayoffs(finishSeason(later, data), data);
    expect(runProgress(drafting)).toBeLessThan(runProgress(inSeason));
    expect(runProgress(inSeason)).toBeLessThan(runProgress(later));
    expect(runProgress(later)).toBeLessThan(runProgress(done));
  });
});

describe("reconcile", () => {
  it("does nothing with no run anywhere", () => {
    expect(reconcile({ local: null, cloud: null, localInAccount: false })).toEqual({ action: "nothing" });
  });

  it("moves a guest run into an empty account", () => {
    expect(reconcile({ local: drafting, cloud: null, localInAccount: false })).toEqual({ action: "upload", run: drafting });
  });

  it("loads the account's run onto a browser with none", () => {
    expect(reconcile({ local: null, cloud: inSeason, localInAccount: false })).toEqual({ action: "download", run: inSeason });
  });

  it("keeps whichever copy of the same run has got further", () => {
    const behind = { ...drafting, id: inSeason.id };
    expect(reconcile({ local: inSeason, cloud: behind, localInAccount: true })).toEqual({ action: "upload", run: inSeason });
    expect(reconcile({ local: behind, cloud: inSeason, localInAccount: true })).toEqual({ action: "download", run: inSeason });
    expect(reconcile({ local: inSeason, cloud: inSeason, localInAccount: true })).toEqual({ action: "nothing" });
  });

  it("follows the account when this browser has an older run of it", () => {
    expect(reconcile({ local: other, cloud: inSeason, localInAccount: true })).toEqual({ action: "download", run: inSeason });
  });

  it("asks when a guest run meets a different run in the account", () => {
    expect(reconcile({ local: other, cloud: inSeason, localInAccount: false })).toEqual({ action: "ask", local: other, cloud: inSeason });
  });
});
