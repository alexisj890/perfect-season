"use client";

// What happens next in the playoffs, and the buttons to play it.

import { useLayoutEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { PlayoffMatch, PlayoffStep } from "@/lib/playoffs/playoffs";

const STEP_TITLE: Record<PlayoffStep, string> = {
  "QF leg 1": "Quarter-finals · 1st legs",
  "QF leg 2": "Quarter-finals · 2nd legs",
  "SF leg 1": "Semi-finals · 1st legs",
  "SF leg 2": "Semi-finals · 2nd legs",
  Final: "The final",
};

interface Props {
  step: PlayoffStep | null; // null once the final is played
  userMatch: PlayoffMatch | null; // the user's match in this step, if any
  names: string[];
  user: number;
  knockedOutBy: string | null; // set once the user is out
  championName: string | null;
  userIsChampion: boolean;
  honour?: "perfect" | "invincible" | null; // the user's season honour, if they won it
  onPlay: () => void;
  onWatch: () => void;
  onSimRest: () => void;
  onFinish: () => void;
}

export function UpNext(props: Props) {
  const { step, userMatch, names, user, knockedOutBy, championName, userIsChampion, honour = null, onPlay, onWatch, onSimRest, onFinish } = props;
  const [confirming, setConfirming] = useState(false);
  const simButton = useRef<HTMLButtonElement>(null);
  // Next.js keeps this page alive in the background; close the pop-up when it's hidden.
  useLayoutEffect(() => () => setConfirming(false), []);
  const primary = "flex-1 rounded-full bg-accent px-4 py-2 font-semibold text-accent-foreground hover:brightness-110";
  const secondary = "rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-accent";

  if (!step) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-accent bg-surface p-4" aria-label="Playoffs complete">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted">Playoffs complete</div>
        <div className="text-2xl font-bold">🏆 {championName}</div>
        <p className="text-sm text-muted">
          {!userIsChampion
            ? "The trophy goes elsewhere this time."
            : honour === "perfect"
              ? "Champions — and a Perfect season: 35 wins from 35!"
              : honour === "invincible"
                ? "Champions — and an Invincible season: unbeaten all year!"
                : "You're the champions!"}
        </p>
        <button type="button" onClick={onFinish} className={primary}>
          See your season review
        </button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4" aria-label="Up next">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">Up next · {STEP_TITLE[step]}</div>
      {userMatch && userMatch.home !== null && userMatch.away !== null ? (
        <div className="flex flex-col gap-1">
          {[userMatch.home, userMatch.away].map((team, i) => (
            <div key={team} className="flex items-center justify-between">
              <span className={`truncate font-semibold ${team === user ? "text-accent" : ""}`}>{names[team]}</span>
              <span className="text-xs text-muted">{userMatch.neutral ? "Neutral" : i === 0 ? "Home" : "Away"}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">
          {knockedOutBy ? `You were knocked out by ${knockedOutBy}.` : "You're not in this round's matches."}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onPlay} className={primary}>
          {userMatch ? "Play match" : "Play round"}
        </button>
        {userMatch && (
          <button type="button" onClick={onWatch} className={secondary}>
            Watch
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <button
          ref={simButton}
          type="button"
          // Only ask while the user still has knockout matches to skip.
          onClick={() => (knockedOutBy ? onSimRest() : setConfirming(true))}
          className={`${secondary} flex-1 text-xs`}
        >
          Sim to the end
        </button>
        {knockedOutBy && (
          <button type="button" onClick={onFinish} className={`${secondary} flex-1 text-xs`}>
            Skip to season review
          </button>
        )}
      </div>
      <ConfirmDialog
        open={confirming}
        title="Sim the rest of the playoffs?"
        confirmLabel="Sim to the end"
        onConfirm={onSimRest}
        onCancel={() => setConfirming(false)}
        returnFocusTo={simButton}
      >
        Your remaining knockout matches will be played in one go. You won&apos;t be able to watch them, but you can still see
        every result and replay your matches afterwards.
      </ConfirmDialog>
    </section>
  );
}
