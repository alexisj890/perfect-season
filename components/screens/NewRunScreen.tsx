"use client";

// The first step of a new run: team name and difficulty, then the draft-position
// reveal, then the draft room. Replacing a run in progress asks for confirmation.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { DraftReveal } from "@/components/home/DraftReveal";
import { NewRunForm } from "@/components/home/NewRunForm";
import { useSavedRun } from "@/components/useSavedRun";
import type { GameData } from "@/lib/data/types";
import type { Difficulty } from "@/lib/draft/config";
import { picksForTeam } from "@/lib/draft/draft";
import { PHASE_ROUTES, runPhase, startRun, userTeam, type RunState } from "@/lib/run";

export function NewRunScreen({ data }: { data: GameData }) {
  const router = useRouter();
  const { run, update } = useSavedRun();
  const [revealing, setRevealing] = useState<RunState | null>(null);
  const inProgress = run !== null && runPhase(run) !== "finished";
  // After a finished run, offer the same team name and difficulty again.
  const lastName = run ? run.draft.teams[userTeam(run)].name : "";
  const defaults = run && !inProgress ? { teamName: lastName === "Your XI" ? "" : lastName, difficulty: run.difficulty } : undefined;

  // Next.js keeps this page alive in the background after you leave it. Close
  // the reveal when it's hidden, so coming back later shows a fresh form rather
  // than the old run's reveal.
  useLayoutEffect(() => () => setRevealing(null), []);

  function start({ teamName, difficulty }: { teamName: string; difficulty: Difficulty }) {
    const next = startRun(data, {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      seed: crypto.getRandomValues(new Uint32Array(1))[0],
      difficulty,
      userName: teamName,
    });
    update(next);
    setRevealing(next);
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-bold">New run</h1>
        <Link href="/" className="text-sm text-muted underline underline-offset-4 hover:text-foreground">
          Back
        </Link>
      </div>
      <div className="rounded-xl border border-border bg-surface p-6">
        {/* Keyed by the run, so the starting values follow the saved run even when
            Next.js has kept this page alive from an earlier visit. */}
        <NewRunForm key={run?.id ?? "none"} hasRunInProgress={inProgress && !revealing} defaults={defaults} onStart={start} />
      </div>
      {revealing && (
        <DraftReveal
          teamName={revealing.draft.teams[userTeam(revealing)].name}
          position={userTeam(revealing) + 1}
          teamCount={revealing.draft.teams.length}
          picks={picksForTeam(revealing.draft, userTeam(revealing))}
          onEnter={() => router.push(PHASE_ROUTES[runPhase(revealing)])}
        />
      )}
    </div>
  );
}
