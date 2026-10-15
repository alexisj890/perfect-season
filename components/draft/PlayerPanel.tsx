// Details for the selected player: who he is, how he'd fit your open slots,
// and the chemistry he'd bring to the squad you have so far.

import type { Player, SlotId } from "@/lib/data/types";
import { displayRating, FIT_STYLE, surname, type ChemistryLink, type SlotOption } from "./draftView";

interface Props {
  player: Player;
  options: SlotOption[];
  chemistry: { total: number; links: ChemistryLink[] };
  canPick: boolean;
  onPick: (slot: SlotId) => void;
}

export function PlayerPanel({ player, options, chemistry, canPick, onPick }: Props) {
  const years = player.stints.map((s) => (s.start === s.end ? `${s.start}` : `${s.start}–${s.end}`)).join(", ");
  return (
    <section className="flex h-full flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-surface p-5" aria-label={`${player.name} details`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{player.name}</h2>
          <p className="text-sm text-muted">
            {player.club} {years} · {player.nationality}
          </p>
          <p className="text-sm text-muted">
            Plays {player.naturalPositions.join("/")}
            {player.secondaryPositions.length > 0 && `, also ${player.secondaryPositions.join("/")}`}
          </p>
        </div>
        <span className="text-3xl font-bold tabular-nums text-accent">{displayRating(player.weightedScore)}</span>
      </div>

      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">In your open slots (best first)</div>
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => (
            <button
              key={o.slot}
              type="button"
              disabled={!canPick}
              onClick={() => onPick(o.slot)}
              title={`${FIT_STYLE[o.fit].label} — draft into ${o.slot}`}
              aria-label={`Draft ${player.name} into ${o.slot}: ${FIT_STYLE[o.fit].label}, rating ${displayRating(o.rating)}`}
              className={`rounded-full border px-2 py-0.5 text-xs tabular-nums ${FIT_STYLE[o.fit].className} enabled:hover:bg-surface-2 disabled:opacity-70`}
            >
              {o.slot} {displayRating(o.rating)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
          Chemistry with your XI: <span className={chemistry.total >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}>
            {chemistry.total >= 0 ? "+" : ""}
            {chemistry.total}
          </span>
        </div>
        {chemistry.links.length === 0 ? (
          <p className="text-sm text-muted">No links with your players yet.</p>
        ) : (
          <ul className="flex flex-col gap-0.5 text-sm">
            {chemistry.links.map((l) => (
              <li key={l.mate.id} className="flex justify-between gap-2">
                <span className="truncate">
                  {surname(l.mate.name)} <span className="text-muted">· {l.links.join(", ")}</span>
                </span>
                <span className="tabular-nums">{l.points > 0 ? `+${l.points}` : l.points}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-auto text-xs text-muted">
        {canPick ? "Click a slot above, or a highlighted slot on the pitch, to draft him." : "Wait for your turn to draft."}
      </p>
    </section>
  );
}

// Shown in the panel's place before a player is selected.
export function PlayerPanelEmpty({ picked, rounds, chemistry }: { picked: number; rounds: number; chemistry: number }) {
  return (
    <section className="flex h-full flex-col justify-center gap-2 rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted">
      <p className="text-foreground">Select a player to see how he fits and the chemistry he&apos;d bring.</p>
      <p className="tabular-nums">
        Your XI: {picked} of {rounds} picked · Chemistry {chemistry}
      </p>
    </section>
  );
}
