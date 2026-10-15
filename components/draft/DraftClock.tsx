"use client";

// The countdown for the user's pick (Settings → Draft timer). Render it with
// key={pickNumber}, so each pick starts a fresh 60 seconds. It only counts
// while the page is visible, so switching tabs pauses it, and it restarts
// after a reload. At zero it calls onExpire (the parent auto-picks).
//
// Screen readers hear the start, a 10-second warning, and nothing in between.

import { useEffect, useRef, useState } from "react";

export const PICK_SECONDS = 60;
export const WARNING_SECONDS = 10;

interface Props {
  seconds?: number;
  onExpire: () => void;
}

export function DraftClock({ seconds = PICK_SECONDS, onExpire }: Props) {
  const [remainingMs, setRemainingMs] = useState(seconds * 1000);
  const expire = useRef(onExpire);
  useEffect(() => {
    expire.current = onExpire;
  });

  useEffect(() => {
    let last = performance.now();
    // Coming back to the tab shouldn't count the time spent away.
    const onVisibility = () => {
      last = performance.now();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const id = setInterval(() => {
      const now = performance.now();
      const elapsed = now - last;
      last = now;
      if (document.visibilityState === "hidden") return;
      setRemainingMs((ms) => Math.max(0, ms - elapsed));
    }, 200);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (remainingMs === 0) expire.current();
  }, [remainingMs]);

  const left = Math.ceil(remainingMs / 1000);
  const warning = left <= WARNING_SECONDS;
  const share = remainingMs / (seconds * 1000);
  const R = 15;
  const C = 2 * Math.PI * R;

  return (
    <div className="flex items-center gap-2" role="timer" aria-label={`${left} seconds left to pick`}>
      <svg viewBox="0 0 36 36" className={`h-9 w-9 -rotate-90 ${warning ? "motion-safe:animate-pulse" : ""}`} aria-hidden="true">
        <circle cx="18" cy="18" r={R} fill="none" strokeWidth="4" className="stroke-border" />
        <circle
          cx="18"
          cy="18"
          r={R}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - share)}
          className={warning ? "stroke-danger" : "stroke-accent"}
        />
      </svg>
      <span className={`w-10 font-semibold tabular-nums ${warning ? "text-danger" : ""}`} aria-hidden="true">
        0:{String(left).padStart(2, "0")}
      </span>
      {/* Announced once each, not every second. */}
      <span className="sr-only" aria-live="polite">
        {warning ? `${WARNING_SECONDS} seconds left to pick` : `Your pick. You have ${seconds} seconds.`}
      </span>
    </div>
  );
}
