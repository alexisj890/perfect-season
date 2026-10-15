// The knockout bracket: quarter-finals → semi-finals → final. Each tie shows
// both legs and the aggregate; the user's ties are gold, the winner bold.

import type { MatchResult } from "@/lib/engine/match";
import { champion, seedOf, tieAggregate, tieWinner, type PlayoffState, type Tie } from "@/lib/playoffs/playoffs";

interface Props {
  state: PlayoffState;
  names: string[];
  user: number;
}

export function Bracket({ state, names, user }: Props) {
  const sfPlaceholder = (i: number) => [`Winner QF ${i * 2 + 1}`, `Winner QF ${i * 2 + 2}`];
  return (
    <div className="grid h-full grid-cols-3 gap-6" role="group" aria-label="Playoff bracket">
      <Column title="Quarter-finals">
        {state.quarterFinals.map((tie, i) => (
          <TieCard key={i} label={`QF ${i + 1}`} tie={tie} state={state} names={names} user={user} />
        ))}
      </Column>
      <Column title="Semi-finals">
        {[0, 1].map((i) =>
          state.semiFinals[i] ? (
            <TieCard key={i} label={`SF ${i + 1}`} tie={state.semiFinals[i]} state={state} names={names} user={user} />
          ) : (
            <Placeholder key={i} label={`SF ${i + 1}`} lines={sfPlaceholder(i)} />
          ),
        )}
      </Column>
      <Column title="Final">
        {state.final ? (
          <FinalCard state={state} names={names} user={user} />
        ) : (
          <Placeholder label="Final · neutral venue" lines={["Winner SF 1", "Winner SF 2"]} />
        )}
      </Column>
    </div>
  );
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex min-h-0 flex-col" aria-label={title}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <div className="flex flex-1 flex-col justify-around gap-3">{children}</div>
    </section>
  );
}

function Placeholder({ label, lines }: { label: string; lines: string[] }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide">{label}</div>
      {lines.map((l) => (
        <div key={l} className="py-0.5">
          {l}
        </div>
      ))}
    </div>
  );
}

// From one team's point of view: its goals in leg 1 and leg 2.
function legGoals(tie: Tie, team: number): [number | null, number | null] {
  const isHigher = team === tie.higher;
  const leg1 = tie.leg1 ? (isHigher ? tie.leg1.awayGoals : tie.leg1.homeGoals) : null; // lower seed hosts leg 1
  const leg2 = tie.leg2 ? (isHigher ? tie.leg2.homeGoals : tie.leg2.awayGoals) : null;
  return [leg1, leg2];
}

function extraNote(result: MatchResult | null): string | null {
  if (!result) return null;
  if (result.shootout) return `aet · pens ${result.shootout.home}–${result.shootout.away}`;
  return result.extraTime ? "aet" : null;
}

function TieCard({ label, tie, state, names, user }: { label: string; tie: Tie; state: PlayoffState; names: string[]; user: number }) {
  const winner = tieWinner(tie);
  const agg = tieAggregate(tie);
  const involvesUser = tie.higher === user || tie.lower === user;
  const note = extraNote(tie.leg2);
  return (
    <div className={`rounded-lg border bg-surface p-3 text-sm ${involvesUser ? "border-accent/60" : "border-border"}`} aria-label={`${label}: ${names[tie.higher]} v ${names[tie.lower]}`}>
      <div className="mb-1 grid grid-cols-[1fr_1.5rem_1.5rem_2rem] gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
        <span>{label}</span>
        <span className="text-right">1st</span>
        <span className="text-right">2nd</span>
        <span className="text-right">Agg</span>
      </div>
      {/* The team that went out is shown in muted text (not faded out), so it stays readable. */}
      {[tie.higher, tie.lower].map((team) => {
        const [l1, l2] = legGoals(tie, team);
        const out = winner !== null && winner !== team;
        return (
          <div key={team} className={`grid grid-cols-[1fr_1.5rem_1.5rem_2rem] items-center gap-1 py-0.5 tabular-nums ${out ? "text-muted" : ""}`}>
            <span className={`truncate ${team === user ? "text-accent" : ""} ${winner === team ? "font-semibold" : ""}`}>
              <span className="mr-1 text-xs text-muted">({seedOf(state, team)})</span>
              {names[team]}
            </span>
            <span className="text-right">{l1 ?? "–"}</span>
            <span className="text-right">{l2 ?? "–"}</span>
            <span className={`text-right ${winner === team ? "font-bold" : ""}`}>
              {agg ? (team === tie.higher ? agg.higher : agg.lower) : "–"}
            </span>
          </div>
        );
      })}
      {note && <div className="mt-1 text-right text-xs text-muted">{note}</div>}
    </div>
  );
}

function FinalCard({ state, names, user }: { state: PlayoffState; names: string[]; user: number }) {
  const f = state.final!;
  const winner = champion(state);
  const note = extraNote(f.result);
  const involvesUser = f.home === user || f.away === user;
  return (
    <div className={`rounded-xl border-2 bg-surface p-4 ${involvesUser ? "border-accent" : "border-border"}`} aria-label="Final result">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Final · neutral venue</div>
      {[f.home, f.away].map((team, i) => {
        const goals = f.result ? (i === 0 ? f.result.homeGoals : f.result.awayGoals) : null;
        return (
          <div key={team} className={`flex items-center justify-between py-1 tabular-nums ${winner !== null && winner !== team ? "text-muted" : ""}`}>
            <span className={`truncate ${team === user ? "text-accent" : ""} ${winner === team ? "font-bold" : ""}`}>
              <span className="mr-1 text-xs text-muted">({seedOf(state, team)})</span>
              {names[team]}
            </span>
            <span className="text-lg font-bold">{goals ?? "–"}</span>
          </div>
        );
      })}
      {note && <div className="text-right text-xs text-muted">{note}</div>}
      {winner !== null && (
        <div className="mt-2 rounded-md bg-accent/15 px-2 py-1 text-center text-sm font-semibold text-accent">🏆 {names[winner]}</div>
      )}
    </div>
  );
}
