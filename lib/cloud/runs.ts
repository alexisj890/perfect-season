// Reading and writing the signed-in player's runs in the `runs` table
// (supabase/migrations/). Row Level Security means these only ever see the
// signed-in player's own rows, and the database fills in user_id itself.

import type { SupabaseClient } from "@supabase/supabase-js";
import { runPhase, type RunState } from "@/lib/run";
import { isUsableRun } from "@/lib/storage";

// The account's most recently saved run, or null (none yet, or one this
// version of the game can't load).
export async function fetchLatestRun(client: SupabaseClient): Promise<RunState | null> {
  const { data, error } = await client.from("runs").select("state").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data && isUsableRun(data.state) ? data.state : null;
}

export async function runIsInAccount(client: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await client.from("runs").select("id").eq("id", id).maybeSingle();
  if (error) throw error;
  return data !== null;
}

// Adds the run, or updates it if it's already saved (same id).
export async function saveRunToAccount(client: SupabaseClient, run: RunState): Promise<void> {
  const { error } = await client
    .from("runs")
    .upsert({ id: run.id, state: run, difficulty: run.difficulty, finished: runPhase(run) === "finished" }, { onConflict: "id" });
  if (error) throw error;
}
