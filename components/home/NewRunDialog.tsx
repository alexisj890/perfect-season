"use client";

// The new-run pop-up on the landing page: team name and difficulty, then the
// draft-position reveal, then the draft room. Opened by "Start a run", "or start
// a new run", or any link to /?new (the end screen's Try again, and the old
// /new page, which redirects here). Replacing a run in progress asks first.

import { useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { DraftReveal } from "@/components/home/DraftReveal";
import { NewRunForm } from "@/components/home/NewRunForm";
import { Modal } from "@/components/ui/Modal";
import type { GameData } from "@/lib/data/types";
import type { Difficulty } from "@/lib/draft/config";
import { picksForTeam } from "@/lib/draft/draft";
import { PHASE_ROUTES, runPhase, startRun, userTeam, type RunState } from "@/lib/run";

interface Props {
  data: GameData;
  open: boolean;
  onClose: () => void;
  run: RunState | null; // the saved run, if any
  update: (run: RunState) => void;
}

export function NewRunDialog({ data, open, onClose, run, update }: Props) {
  const router = useRouter();
  const [revealing, setRevealing] = useState<RunState | null>(null);
  const inProgress = run !== null && runPhase(run) !== "finished";
  // After a finished run, offer the same team name and difficulty again.
  const lastName = run ? run.draft.teams[userTeam(run)].name : "";
  const defaults = run && !inProgress ? { teamName: lastName === "Your XI" ? "" : lastName, difficulty: run.difficulty } : undefined;

  // Next.js keeps the landing page alive in the background after you leave it.
  // Drop the reveal when it's hidden, so the pop-up opens fresh next time.
  useLayoutEffect(() => () => setRevealing(null), []);

  function close() {
    setRevealing(null);
    onClose();
  }

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
    <Modal open={open} onClose={close} title={revealing ? "The draw is in" : "New run"} narrow>
      {revealing ? (
        <DraftReveal
          teamName={revealing.draft.teams[userTeam(revealing)].name}
          position={userTeam(revealing) + 1}
          teamCount={revealing.draft.teams.length}
          picks={picksForTeam(revealing.draft, userTeam(revealing))}
          // Leaving the page hides the pop-up; its state resets as the page is hidden.
          onEnter={() => router.push(PHASE_ROUTES[runPhase(revealing)])}
        />
      ) : (
        // Keyed by the run, so the starting values follow the saved run.
        <NewRunForm key={run?.id ?? "none"} hasRunInProgress={inProgress} defaults={defaults} onStart={start} />
      )}
    </Modal>
  );
}
