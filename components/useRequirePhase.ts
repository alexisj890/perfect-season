"use client";

// Keeps each screen in step with the run: with no run, go home; if the run is
// in a different phase (say /season during the draft), go to that phase's screen.
// Returns true once the screen may render.

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { PHASE_ROUTES, runPhase, type RunPhase, type RunState } from "@/lib/run";

export function useRequirePhase(run: RunState | null, phase: RunPhase): boolean {
  const router = useRouter();
  // Keep the dev panel open across redirects (?dev has no value, so write it as-is).
  const query = useSearchParams().has("dev") ? "dev" : "";
  const target = run === null ? "/" : PHASE_ROUTES[runPhase(run)];
  const ready = run !== null && runPhase(run) === phase;

  useEffect(() => {
    if (!ready) router.replace(query ? `${target}?${query}` : target);
  }, [ready, router, target, query]);

  return ready;
}
