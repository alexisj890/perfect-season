import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadGameData } from "@/lib/data/load";
import { finishDraft, finishPlayoffs, finishSeason, startRun } from "@/lib/run";
import { fetchLatestRun, runIsInAccount, saveRunToAccount } from "./runs";

const data = loadGameData();
const run = startRun(data, { id: "8b0c7a2e-0000-4000-8000-000000000001", createdAt: "", seed: 2, difficulty: "hard" });

// A stand-in for the Supabase client that records each call and answers with `result`.
function fakeClient(result: { data?: unknown; error?: unknown }) {
  const calls: [string, unknown[]][] = [];
  const query: Record<string, unknown> = {};
  for (const method of ["select", "order", "limit", "eq", "upsert"]) {
    query[method] = (...args: unknown[]) => {
      calls.push([method, args]);
      return method === "upsert" ? Promise.resolve({ error: result.error ?? null }) : query;
    };
  }
  query.maybeSingle = () => Promise.resolve({ data: result.data ?? null, error: result.error ?? null });
  const from = vi.fn(() => query);
  return { client: { from } as unknown as SupabaseClient, calls, from };
}

describe("fetchLatestRun", () => {
  it("asks for the newest run and returns its state", async () => {
    const { client, calls, from } = fakeClient({ data: { state: run } });
    expect(await fetchLatestRun(client)).toEqual(run);
    expect(from).toHaveBeenCalledWith("runs");
    expect(calls).toContainEqual(["order", ["updated_at", { ascending: false }]]);
    expect(calls).toContainEqual(["limit", [1]]);
  });

  it("ignores a run saved by an older version of the game", async () => {
    const { client } = fakeClient({ data: { state: { ...run, version: 0 } } });
    expect(await fetchLatestRun(client)).toBeNull();
  });

  it("passes errors on", async () => {
    const { client } = fakeClient({ error: new Error("offline") });
    await expect(fetchLatestRun(client)).rejects.toThrow("offline");
  });
});

describe("runIsInAccount", () => {
  it("looks the run up by id", async () => {
    const { client, calls } = fakeClient({ data: { id: run.id } });
    expect(await runIsInAccount(client, run.id)).toBe(true);
    expect(calls).toContainEqual(["eq", ["id", run.id]]);
    expect(await runIsInAccount(fakeClient({ data: null }).client, run.id)).toBe(false);
  });
});

describe("saveRunToAccount", () => {
  it("adds or updates the row by id, never sending a user id (the database fills it in)", async () => {
    const { client, calls } = fakeClient({});
    await saveRunToAccount(client, run);
    const [method, [row, options]] = calls[0] as [string, [Record<string, unknown>, unknown]];
    expect(method).toBe("upsert");
    expect(row).toEqual({ id: run.id, state: run, difficulty: "hard", finished: false });
    expect(row).not.toHaveProperty("user_id");
    expect(options).toEqual({ onConflict: "id" });
  });

  it("marks a finished run", async () => {
    const done = finishPlayoffs(finishSeason(finishDraft(run, data), data), data);
    const { client, calls } = fakeClient({});
    await saveRunToAccount(client, done);
    expect((calls[0][1][0] as { finished: boolean }).finished).toBe(true);
  });
});
