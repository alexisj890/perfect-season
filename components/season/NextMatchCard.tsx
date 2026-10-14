// The user's next league match: who, where, how the teams compare, and Play / Watch.

import { FormChips } from "./FormChips";
import type { FormLetter } from "./seasonView";

export interface TeamLine {
  name: string;
  position: number;
  rating: number; // XI average
  form: FormLetter[];
  isUser: boolean;
}

interface Props {
  matchday: number;
  home: TeamLine;
  away: TeamLine;
  onPlay: () => void;
}

export function NextMatchCard({ matchday, home, away, onPlay }: Props) {
  const venue = home.isUser ? "Home" : "Away";
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4" aria-label="Next match">
      <div className="flex items-baseline justify-between text-xs font-semibold uppercase tracking-wide text-muted">
        <span>Next match · Matchday {matchday}</span>
        <span>{venue}</span>
      </div>
      <div className="flex flex-col gap-2">
        {[home, away].map((t, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className={`truncate font-semibold ${t.isUser ? "text-accent" : ""}`}>{t.name}</div>
              <div className="text-xs tabular-nums text-muted">
                {ordinal(t.position)} · XI {t.rating}
              </div>
            </div>
            <FormChips form={t.form} />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPlay}
          className="flex-1 rounded-full bg-accent px-4 py-2 font-semibold text-accent-foreground hover:brightness-110"
        >
          Play match
        </button>
        <button
          type="button"
          disabled
          title="Match replays are coming in the next update"
          className="rounded-full border border-border px-4 py-2 text-sm text-muted opacity-60"
        >
          Watch
        </button>
      </div>
    </section>
  );
}

export function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
}
