"use client";

// Temporary match screen; the replay arrives in Milestone 6.4.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useSavedRun } from "@/components/useSavedRun";
import { PHASE_ROUTES, runPhase } from "@/lib/run";

export function MatchPlaceholder() {
  const { id } = useParams<{ id: string }>();
  const { run } = useSavedRun();
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-3xl font-bold">Match replay</h1>
      <p className="text-muted">Match “{id}” — the replay is coming in Milestone 6.4.</p>
      <Link className="text-accent underline" href={run ? PHASE_ROUTES[runPhase(run)] : "/"}>
        Back
      </Link>
    </section>
  );
}
