"use client";

// The landing page's one main button: continue the saved run, or start one.
// Reads the save from the browser, so it renders inside <Suspense>.

import Link from "next/link";
import { DevPanel } from "@/components/DevPanel";
import { useSavedRun } from "@/components/useSavedRun";
import type { GameData } from "@/lib/data/types";
import { PHASE_ROUTES, runPhase, runStatusLine, userTeam } from "@/lib/run";

// No hover animation: the dots are the landing page's only animation.
export const pill =
  "rounded-full bg-accent px-8 py-3.5 text-lg font-semibold text-accent-foreground shadow-lg shadow-black/20 hover:brightness-110";

export function PrimaryAction({ data }: { data: GameData }) {
  const { run, update, clear } = useSavedRun();

  return (
    <div className="flex min-h-28 flex-col items-center gap-2">
      {run ? (
        <>
          <Link href={PHASE_ROUTES[runPhase(run)]} className={pill}>
            Continue {run.draft.teams[userTeam(run)].name}
          </Link>
          <div className="text-sm tabular-nums text-muted">{runStatusLine(run)}</div>
          <Link href="/new" className="text-sm text-muted underline underline-offset-4 hover:text-foreground">
            or start a new run
          </Link>
        </>
      ) : (
        <Link href="/new" className={pill}>
          Start a run
        </Link>
      )}
      <DevPanel data={data} run={run} update={update} clear={clear} />
    </div>
  );
}

// Holds the space while the save loads, so nothing jumps.
export function PrimaryActionPlaceholder() {
  return <div className="min-h-28" aria-hidden="true" />;
}
