"use client";

// How the account save is doing, for the header ("Saving…", "Saved"), plus a
// way to send a pending save right away (before signing out).

import { useSyncExternalStore } from "react";

export type SyncStatus = "idle" | "saving" | "saved" | "error";

let status: SyncStatus = "idle";
const listeners = new Set<() => void>();
let flush: (() => Promise<void>) | null = null;

export function setSyncStatus(next: SyncStatus) {
  if (next === status) return;
  status = next;
  for (const listener of listeners) listener();
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => status,
    () => "idle",
  );
}

// CloudSync registers how to save immediately; the sign-out button calls it.
export function registerFlush(fn: (() => Promise<void>) | null) {
  flush = fn;
}

export async function flushCloudSave() {
  await flush?.();
}
