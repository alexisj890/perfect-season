"use client";

// Temporary screen for a phase that isn't built yet: shows where the run is and
// offers the dev panel. Replaced page by page in Milestones 6.1–6.6.

import { DevPanel } from "@/components/DevPanel";
import { useRequirePhase } from "@/components/useRequirePhase";
import { useSavedRun } from "@/components/useSavedRun";
import type { GameData } from "@/lib/data/types";
import { runSummary, type RunPhase } from "@/lib/run";

interface Props {
  data: GameData;
  phase: RunPhase;
  title: string;
  comingIn: string;
}

export function PhasePlaceholder({ data, phase, title, comingIn }: Props) {
  const { run, update, clear } = useSavedRun();
  const ready = useRequirePhase(run, phase);
  if (!ready) return null;

  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-muted">{runSummary(run!)}</p>
      <p className="rounded-lg border border-dashed border-border p-6 text-muted">
        This screen is coming in Milestone {comingIn}. Add <code className="text-accent">?dev</code> to the URL to jump
        ahead.
      </p>
      <DevPanel data={data} run={run} update={update} clear={clear} />
    </section>
  );
}
