// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSavedRun, updateRun } from "@/components/useSavedRun";
import { loadGameData } from "@/lib/data/load";
import { finishDraft, playLeague, startRun, type RunState } from "@/lib/run";
import { loadRun } from "@/lib/storage";
import { CloudSync, SAVE_DELAY_MS } from "./CloudSync";

// Who's signed in, and what the account holds, are both faked.
let user: { id: string; email: string } | null | undefined = undefined;
vi.mock("@/components/useAuth", () => ({ useAuth: () => user }));
vi.mock("@/lib/supabase/client", () => ({ browserSupabase: () => ({}) }));
const cloud = { latest: null as RunState | null, ids: new Set<string>(), saved: [] as RunState[] };
vi.mock("@/lib/cloud/runs", () => ({
  fetchLatestRun: async () => cloud.latest,
  runIsInAccount: async (_: unknown, id: string) => cloud.ids.has(id),
  saveRunToAccount: async (_: unknown, run: RunState) => {
    cloud.saved.push(run);
  },
}));

const data = loadGameData();
const guestRun = startRun(data, { id: "guest", createdAt: "", seed: 1, difficulty: "easy", userName: "Guest FC" });
const accountRun = playLeague(finishDraft(startRun(data, { id: "account", createdAt: "", seed: 2, difficulty: "hard", userName: "Alexis FC" }), data), data, "matchday");

const app = () => (
  <Suspense fallback={null}>
    <CloudSync />
  </Suspense>
);
async function signIn(view: ReturnType<typeof render>) {
  user = { id: "u1", email: "alexis@example.com" };
  await act(async () => view.rerender(app()));
}

beforeEach(() => {
  user = null;
  cloud.latest = null;
  cloud.ids = new Set();
  cloud.saved = [];
  clearSavedRun();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("CloudSync", () => {
  it("moves a guest run into an empty account when signing in", async () => {
    updateRun(guestRun);
    const view = render(app());
    await signIn(view);
    expect(cloud.saved.map((r) => r.id)).toEqual(["guest"]);
    expect(loadRun()!.id).toBe("guest");
  });

  it("loads the account's run onto a browser with none", async () => {
    cloud.latest = accountRun;
    const view = render(app());
    await signIn(view);
    expect(loadRun()!.id).toBe("account");
    expect(cloud.saved).toEqual([]); // nothing to send back
  });

  it("asks which run to keep when both exist, and keeps the choice", async () => {
    updateRun(guestRun);
    cloud.latest = accountRun;
    const view = render(app());
    await signIn(view);
    const dialog = screen.getByRole("dialog", { name: "Which run do you want to keep?" });
    expect(dialog.textContent).toContain("Guest FC");
    expect(dialog.textContent).toContain("Alexis FC");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /In your account/ })));
    expect(loadRun()!.id).toBe("account");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("saves changes to the account a moment after the last one", async () => {
    cloud.latest = accountRun;
    cloud.ids.add("account");
    const view = render(app());
    await signIn(view);
    vi.useFakeTimers();
    const next = playLeague(accountRun, data, "matchday");
    await act(async () => updateRun(next));
    expect(cloud.saved).toEqual([]);
    await act(async () => vi.advanceTimersByTime(SAVE_DELAY_MS + 10));
    expect(cloud.saved).toEqual([next]);
  });

  it("clears this computer's copy on sign-out, but not for a guest who never signed in", async () => {
    updateRun(guestRun);
    const view = render(app());
    await act(async () => view.rerender(app())); // a guest all along
    expect(loadRun()).not.toBeNull();
    await signIn(view);
    user = null;
    await act(async () => view.rerender(app()));
    expect(loadRun()).toBeNull();
  });
});
