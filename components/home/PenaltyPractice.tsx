"use client";

// The footer's "Warm up" button and the penalty practice modal. The session
// (score, streak, best) lives here, so it's kept when the modal closes and reopens.

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { practiceReducer, startPractice } from "@/lib/minigame/practice";
import { PenaltyGame } from "./PenaltyGame";

const BEST_KEY = "perfect-season:penalty-best";

function readBest(): number {
  if (typeof window === "undefined") return 0; // pre-rendering on the server
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function PenaltyPractice() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [game, dispatch] = useReducer(practiceReducer, undefined, () => startPractice(readBest()));
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    try {
      localStorage.setItem(BEST_KEY, String(game.best));
    } catch {
      // Storage can be blocked; the best streak just won't be remembered.
    }
  }, [game.best]);

  const stats = (
    <span className="text-sm tabular-nums text-muted">
      Goals <b className="text-foreground">{game.goals}</b>/{game.shots} · Streak{" "}
      <b className="text-foreground">{game.streak}</b> · Best <b className="text-accent">{game.best}</b>
    </span>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-border px-4 py-2 text-sm text-muted hover:border-accent hover:text-foreground"
      >
        Warm up: penalty practice
      </button>
      <Modal open={open} onClose={close} title="Penalty practice" headerExtra={stats} returnFocusTo={triggerRef}>
        <PenaltyGame game={game} dispatch={dispatch} />
      </Modal>
    </>
  );
}
