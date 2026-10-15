// Round and pick, who's on the clock (with the pick timer, if it's on), the
// latest picks, and Skip / Auto-pick.

import type { ReactNode } from "react";

interface Props {
  round: number;
  rounds: number;
  pickNumber: number;
  totalPicks: number;
  onClock: string | null; // team name, or null when the draft is over
  usersTurn: boolean;
  recent: { label: string; mine: boolean }[]; // newest first
  onSkip: () => void;
  onAutoPick: () => void;
  view: "draft" | "board";
  onView: (view: "draft" | "board") => void;
  clock?: ReactNode; // the pick timer, on the user's turn
  notice?: string | null; // e.g. what the timer picked when it ran out
}

export function DraftTopBar(props: Props) {
  const { round, rounds, pickNumber, totalPicks, onClock, usersTurn, recent, onSkip, onAutoPick, view, onView, clock, notice } = props;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface px-5 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="text-sm tabular-nums text-muted">
            Round <b className="text-foreground">{round}</b> of {rounds} · Pick <b className="text-foreground">{pickNumber}</b> of{" "}
            {totalPicks}
          </div>
          <div className="flex rounded-full border border-border p-0.5" role="tablist" aria-label="Draft views">
            {(["draft", "board"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => onView(v)}
                className={`rounded-full px-3 py-0.5 text-xs font-semibold ${view === v ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"}`}
              >
                {v === "draft" ? "Your XI" : "Draft board"}
              </button>
            ))}
          </div>
        </div>
        {onClock && (
          <div className="flex items-center gap-3">
            {usersTurn && clock}
            <span className="text-sm">
              On the clock: <b className={usersTurn ? "text-accent" : ""}>{usersTurn ? `${onClock} (you)` : onClock}</b>
            </span>
            {usersTurn ? (
              <button
                type="button"
                onClick={onAutoPick}
                className="rounded-full border border-border px-3 py-1 text-xs font-semibold hover:border-accent"
              >
                Auto-pick
              </button>
            ) : (
              <button
                type="button"
                onClick={onSkip}
                className="rounded-full border border-border px-3 py-1 text-xs font-semibold hover:border-accent"
              >
                Skip to my pick
              </button>
            )}
          </div>
        )}
      </div>
      <p role="status" className="text-sm font-semibold empty:hidden">
        {notice}
      </p>
      <ol
        className="flex gap-4 overflow-hidden whitespace-nowrap text-xs text-muted [mask-image:linear-gradient(to_right,black_85%,transparent)]"
        aria-label="Latest picks"
      >
        {recent.map((r, i) => (
          <li key={i} className={r.mine ? "font-semibold text-accent" : i === 0 ? "text-foreground" : ""}>
            {r.label}
          </li>
        ))}
      </ol>
    </div>
  );
}
