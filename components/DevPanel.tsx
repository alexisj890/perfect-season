"use client";

// Shortcuts for testing: add ?dev to any game URL to jump ahead without playing
// a whole run. Hidden otherwise.

import { useRouter, useSearchParams } from "next/navigation";
import type { GameData } from "@/lib/data/types";
import { finishDraft, finishPlayoffs, finishSeason, PHASE_ROUTES, runPhase, type RunState } from "@/lib/run";

interface Props {
  data: GameData;
  run: RunState | null;
  update: (run: RunState) => void;
  clear: () => void;
}

export function DevPanel({ data, run, update, clear }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  if (!params.has("dev")) return null;

  const go = (next: RunState) => {
    update(next);
    router.push(`${PHASE_ROUTES[runPhase(next)]}?dev`);
  };
  const phase = run ? runPhase(run) : null;
  const button = "rounded border border-border px-2 py-1 hover:bg-surface-2 disabled:opacity-40";

  return (
    <aside className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 rounded-lg border border-accent bg-surface p-3 text-xs shadow-lg">
      <div className="font-semibold text-accent">Dev panel · {phase ?? "no run"}</div>
      <div className="flex gap-2">
        <button className={button} disabled={phase !== "draft"} onClick={() => go(finishDraft(run!, data))}>
          Finish draft
        </button>
        <button className={button} disabled={phase !== "season"} onClick={() => go(finishSeason(run!, data))}>
          Finish season
        </button>
        <button className={button} disabled={phase !== "playoffs"} onClick={() => go(finishPlayoffs(run!, data))}>
          Finish playoffs
        </button>
        <button
          className={button}
          disabled={!run}
          onClick={() => {
            clear();
            router.push("/?dev");
          }}
        >
          Delete run
        </button>
      </div>
    </aside>
  );
}
