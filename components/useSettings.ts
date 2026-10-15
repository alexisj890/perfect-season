"use client";

// The player's settings (Settings menu in the header), saved in this browser.
// Like useSavedRun: one shared copy in memory, so every screen sees a change
// straight away, including pages Next.js keeps alive in the background.

import { useSyncExternalStore } from "react";
import { SETTINGS_STORAGE_KEY } from "./settingsScript";

export { SETTINGS_STORAGE_KEY };

export interface Settings {
  draftTimer: boolean; // 60 seconds per pick, then the best available player is picked for you
  largeText: boolean; // every text size a step up (<html data-text-size="large">)
}

export const DEFAULT_SETTINGS: Settings = { draftTimer: true, largeText: false };

let cached: Settings | undefined;
const listeners = new Set<() => void>();

function read(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "{}");
    // Fill in anything missing, so settings added later get their defaults.
    return { ...DEFAULT_SETTINGS, ...(typeof saved === "object" && saved ? saved : {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function getSnapshot(): Settings {
  if (cached === undefined) cached = read();
  return cached;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Changed in another tab.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== SETTINGS_STORAGE_KEY && event.key !== null) return;
    cached = undefined;
    applyTextSize(getSnapshot().largeText);
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function changeSettings(change: Partial<Settings>) {
  cached = { ...getSnapshot(), ...change };
  applyTextSize(cached.largeText);
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // Storage can be blocked (private mode); the change still applies for this visit.
  }
  for (const listener of listeners) listener();
}

// Larger text is a CSS switch on <html> (see app/globals.css). The script in
// settingsScript.ts sets it before the first paint; this keeps it in step after.
function applyTextSize(large: boolean) {
  if (large) document.documentElement.setAttribute("data-text-size", "large");
  else document.documentElement.removeAttribute("data-text-size");
}

// On the server (and during the first paint) everyone has the defaults.
export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_SETTINGS);
}
