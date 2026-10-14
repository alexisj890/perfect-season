// Shown when the draft is over: how the user's XI rates against the league.

interface Props {
  teamName: string;
  rank: number; // 1–16 by overall strength
  teamCount: number;
  attack: number; // relative to an average XI
  defence: number;
  chemistry: number;
  onStart: () => void;
}

const signed = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

export function DraftSummary({ teamName, rank, teamCount, attack, defence, chemistry, onStart }: Props) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-accent bg-surface p-6" aria-label="Draft complete">
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest text-muted">Draft complete</div>
        <h2 className="text-2xl font-bold">{teamName}</h2>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm tabular-nums">
        <div>
          <dt className="text-muted">On paper</dt>
          <dd className="text-xl font-semibold">
            {ordinal(rank)} <span className="text-sm font-normal text-muted">of {teamCount}</span>
          </dd>
        </div>
        <div>
          <dt className="text-muted">Chemistry</dt>
          <dd className="text-xl font-semibold">{chemistry}</dd>
        </div>
        <div>
          <dt className="text-muted">Attack</dt>
          <dd className="text-xl font-semibold">{signed(attack)}</dd>
        </div>
        <div>
          <dt className="text-muted">Defence</dt>
          <dd className="text-xl font-semibold">{signed(defence)}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted">Attack and defence are compared with an average all-time XI.</p>
      <button type="button" onClick={onStart} className="rounded-full bg-accent px-6 py-3 font-semibold text-accent-foreground hover:brightness-110">
        Start the season
      </button>
    </section>
  );
}
