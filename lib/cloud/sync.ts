// Deciding which copy of a run to keep when a signed-in player has one in the
// browser and one in their account. Pure functions, so they're easy to test.
//
// A run only ever moves forward (picks, then matches), so "how far it has got"
// tells two copies of the same run apart without trusting anyone's clock.

import { playoffMatches } from "@/lib/playoffs/playoffs";
import type { RunState } from "@/lib/run";

export function runProgress(run: RunState): number {
  const leagueMatches = run.season?.matches.filter((m) => m.result).length ?? 0;
  const knockoutMatches = run.playoffs ? playoffMatches(run.playoffs).filter((m) => m.result).length : 0;
  return (
    run.draft.picks.length +
    (run.season ? 1 : 0) +
    leagueMatches +
    (run.playoffs ? 1 : 0) +
    knockoutMatches +
    (run.ended ? 1 : 0)
  );
}

export type SyncDecision =
  | { action: "nothing" }
  | { action: "upload"; run: RunState } // the browser's copy is the one to keep
  | { action: "download"; run: RunState } // the account's copy replaces the browser's
  | { action: "ask"; local: RunState; cloud: RunState }; // two different runs: the player chooses

interface Situation {
  local: RunState | null; // the run saved in this browser
  cloud: RunState | null; // the account's most recently saved run
  // Whether the browser's run is one of the account's runs (an older one, if
  // it isn't `cloud`). Only matters when the two are different runs.
  localInAccount: boolean;
}

export function reconcile({ local, cloud, localInAccount }: Situation): SyncDecision {
  if (!local && !cloud) return { action: "nothing" };
  if (local && !cloud) return { action: "upload", run: local };
  if (!local) return { action: "download", run: cloud! };
  if (local.id === cloud!.id) {
    const ahead = runProgress(local) - runProgress(cloud!);
    if (ahead > 0) return { action: "upload", run: local };
    if (ahead < 0) return { action: "download", run: cloud! };
    return { action: "nothing" };
  }
  // Two different runs. If this browser's run is an older one from the account,
  // the account has moved on (a new run on another device): follow it. If not,
  // it's a guest run being brought into the account: the player decides.
  return localInAccount ? { action: "download", run: cloud! } : { action: "ask", local, cloud: cloud! };
}
