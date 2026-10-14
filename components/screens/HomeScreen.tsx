"use client";

// The home screen. For now: continue a saved run or start a new one.
// Milestone 6.1 adds sign-in, team naming and the draft-position reveal.

import { useRouter } from "next/navigation";
import { DevPanel } from "@/components/DevPanel";
import { useSavedRun } from "@/components/useSavedRun";
import type { GameData } from "@/lib/data/types";
import type { Difficulty } from "@/lib/draft/config";
import { PHASE_ROUTES, runPhase, runSummary, startRun } from "@/lib/run";

const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: "easy", label: "Easy" },
  { id: "normal", label: "Normal" },
  { id: "hard", label: "Hard" },
];

export function HomeScreen({ data }: { data: GameData }) {
  const router = useRouter();
  const { run, update, clear } = useSavedRun();

  function newRun(difficulty: Difficulty) {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const next = startRun(data, { id: crypto.randomUUID(), createdAt: new Date().toISOString(), seed, difficulty });
    update(next);
    router.push(PHASE_ROUTES[runPhase(next)]);
  }

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="text-4xl font-bold">Perfect Season</h1>
        <p className="mt-2 text-muted">Draft an all-time XI, then try to win all 35 matches.</p>
      </div>

      {run && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-5">
          <div>
            <div className="font-semibold">Continue your run</div>
            <div className="text-sm text-muted">{runSummary(run)}</div>
          </div>
          <button
            className="rounded-full bg-accent px-5 py-2 font-semibold text-accent-foreground"
            onClick={() => router.push(PHASE_ROUTES[runPhase(run)])}
          >
            Continue
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="font-semibold">{run ? "Or start over" : "New run"}</div>
        <div className="flex gap-3">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              className="rounded-lg border border-border bg-surface px-6 py-3 hover:border-accent"
              onClick={() => newRun(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
      <DevPanel data={data} run={run} update={update} clear={clear} />
    </section>
  );
}
