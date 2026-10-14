"use client";

// The landing page: what the game is, account, continue, and a new run.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DevPanel } from "@/components/DevPanel";
import { AccountPanel } from "@/components/home/AccountPanel";
import { DraftReveal } from "@/components/home/DraftReveal";
import { Hero } from "@/components/home/Hero";
import { NewRunForm } from "@/components/home/NewRunForm";
import { card } from "@/components/ui/card";
import { useSavedRun } from "@/components/useSavedRun";
import type { GameData } from "@/lib/data/types";
import type { Difficulty } from "@/lib/draft/config";
import { picksForTeam } from "@/lib/draft/draft";
import { PHASE_ROUTES, runPhase, runSummary, startRun, userTeam, type RunState } from "@/lib/run";

const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: "Easy", normal: "Normal", hard: "Hard" };

export function HomeScreen({ data }: { data: GameData }) {
  const router = useRouter();
  const { run, update, clear } = useSavedRun();
  const [revealing, setRevealing] = useState<RunState | null>(null);

  function start({ teamName, difficulty }: { teamName: string; difficulty: Difficulty }) {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const next = startRun(data, {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      seed,
      difficulty,
      userName: teamName,
    });
    update(next);
    setRevealing(next);
  }

  const inProgress = run !== null && runPhase(run) !== "finished";

  return (
    <div className="grid grid-cols-[1.2fr_1fr] gap-12">
      <Hero />

      <div className="flex flex-col gap-5">
        <AccountPanel />

        {run && !revealing && (
          <section className={`${card} flex items-center justify-between gap-4`}>
            <div>
              <div className="font-semibold">{run.draft.teams[userTeam(run)].name}</div>
              <div className="text-sm text-muted">
                {DIFFICULTY_LABEL[run.difficulty]} · {runSummary(run)}
              </div>
            </div>
            <button
              className="shrink-0 rounded-full bg-accent px-5 py-2 font-semibold text-accent-foreground"
              onClick={() => router.push(PHASE_ROUTES[runPhase(run)])}
            >
              {inProgress ? "Continue" : "View result"}
            </button>
          </section>
        )}

        <NewRunForm hasRunInProgress={inProgress && !revealing} onStart={start} />
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
      <DevPanel data={data} run={run} update={update} clear={clear} />
    </div>
  );
}
