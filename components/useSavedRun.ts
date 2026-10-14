"use client";

// Reads and writes the current run in this browser. Components using this hook
// only render in the browser (the server can't see localStorage), so they must
// sit inside a <Suspense> boundary; its fallback shows until the browser takes over.

import { use, useCallback, useState } from "react";
import { browser } from "react-dom";
import type { RunState } from "@/lib/run";
import { clearRun, loadRun, saveRun } from "@/lib/storage";

export function useSavedRun() {
  use(browser("The current run is saved in this browser's localStorage."));
  const [run, setRun] = useState<RunState | null>(() => loadRun());

  const update = useCallback((next: RunState) => {
    try {
      saveRun(next);
    } catch (error) {
      console.error("Couldn't save the run", error);
    }
    setRun(next);
  }, []);

  const clear = useCallback(() => {
    clearRun();
    setRun(null);
  }, []);

  return { run, update, clear };
}
