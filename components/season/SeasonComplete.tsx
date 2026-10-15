// Shown after the last matchday: where the user finished, and what's next.

import { ordinal } from "./NextMatchCard";

interface Props {
  position: number;
  record: { won: number; drawn: number; lost: number };
  qualified: boolean;
  onContinue: () => void;
}

export function SeasonComplete({ position, record, qualified, onContinue }: Props) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-accent bg-surface p-5" aria-label="Season complete">
      <div className="text-xs font-semibold uppercase tracking-widest text-muted">Season complete</div>
      <div>
        <div className="font-display text-5xl font-extrabold tabular-nums">{ordinal(position)}</div>
        <div className="text-sm tabular-nums text-muted">
          {record.won}W {record.drawn}D {record.lost}L
        </div>
      </div>
      <p className="text-sm text-muted">
        {qualified ? "You're through to the knockouts." : "You finished outside the top 8."}
      </p>
      <button
        type="button"
        onClick={onContinue}
        className="rounded-full bg-accent px-4 py-2.5 font-semibold text-accent-foreground hover:brightness-110"
      >
        {qualified ? "Continue to the playoffs" : "See your season review"}
      </button>
    </section>
  );
}
