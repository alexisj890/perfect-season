"use client";

// The current run, shared by every screen. There is one copy in memory
// (backed by localStorage), and every component using this hook re-renders
// when it changes — including pages Next.js keeps alive in the background
// (Activity) and other browser tabs. Without this, a preserved page could keep
// showing an old run.
//
// Components using this hook only render in the browser (the server can't see
// localStorage), so they must sit inside a <Suspense> boundary.

import { use, useSyncExternalStore } from "react";
import { browser } from "react-dom";
import type { RunState } from "@/lib/run";
import { clearRun, loadRun, RUN_STORAGE_KEY, saveRun } from "@/lib/storage";

let cached: RunState | null | undefined; // undefined = not read yet
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function getSnapshot(): RunState | null {
  if (cached === undefined) cached = loadRun();
  return cached;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab saved or cleared the run.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== RUN_STORAGE_KEY && event.key !== null) return;
    cached = undefined;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function updateRun(next: RunState) {
  try {
    saveRun(next);
  } catch (error) {
    console.error("Couldn't save the run", error);
  }
  cached = next;
  notify();
}

export function clearSavedRun() {
  clearRun();
  cached = null;
  notify();
}

export function useSavedRun() {
  use(browser("The current run is saved in this browser's localStorage."));
  const run = useSyncExternalStore(subscribe, getSnapshot, () => null);
  return { run, update: updateRun, clear: clearSavedRun };
}
