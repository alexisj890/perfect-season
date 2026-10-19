// Saving the current run in the browser (localStorage). Only call these from
// client components: the server has no localStorage.

import { RUN_VERSION, type RunState } from "./run";

export const RUN_STORAGE_KEY = "perfect-season:run";

// The saved run, or null if there is none or it can't be used (corrupted, or
// saved by an older version of the game).
export function loadRun(storage: Storage = localStorage): RunState | null {
  try {
    const text = storage.getItem(RUN_STORAGE_KEY);
    if (!text) return null;
    const run = JSON.parse(text);
    return isUsableRun(run) ? run : null;
  } catch {
    return null;
  }
}

// A saved run this version of the game can load (from the browser or the
// database): the right shape and the current save version.
export function isUsableRun(value: unknown): value is RunState {
  const run = value as RunState | null;
  return run?.version === RUN_VERSION && !!run.draft;
}

export function saveRun(run: RunState, storage: Storage = localStorage): void {
  storage.setItem(RUN_STORAGE_KEY, JSON.stringify(run));
}

export function clearRun(storage: Storage = localStorage): void {
  storage.removeItem(RUN_STORAGE_KEY);
}
