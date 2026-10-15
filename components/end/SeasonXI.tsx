// The user's XI on a pitch, each player with their season average rating.
// Gold ring for the player of the season.

import type { FormationSlot, Player } from "@/lib/data/types";
import type { SeasonPlayerStats } from "@/lib/engine/ratings";
import { surname } from "@/components/draft/draftView";
import { RatingBadge } from "@/components/ratings/RatingBadge";
import { inset, VERTICAL_PITCH_HEIGHT, VerticalPitchMarkings } from "@/components/ui/VerticalPitch";

interface Props {
  slots: FormationSlot[];
  squad: SeasonPlayerStats[];
  playersById: Map<string, Player>;
  bestId: string | null;
}

export function SeasonXI({ slots, squad, playersById, bestId }: Props) {
  const slotById = new Map(slots.map((s) => [s.id, s]));
  return (
    <div className="relative mx-auto aspect-[100/130] h-full max-w-full overflow-hidden rounded-2xl border border-border">
      <svg viewBox={`0 0 100 ${VERTICAL_PITCH_HEIGHT}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
        <VerticalPitchMarkings />
      </svg>
      <ul aria-label="Your XI with season average ratings">
        {squad.map((s) => {
          const slot = slotById.get(s.slot as FormationSlot["id"]);
          const player = playersById.get(s.playerId);
          if (!slot || !player) return null;
          const best = s.playerId === bestId;
          return (
            <li
              key={s.playerId}
              className="absolute flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
              style={{ left: `${inset(slot.pitchX, 6)}%`, top: `${inset(slot.pitchY, 6)}%` }}
              aria-label={`${slot.id}: ${player.name}, average ${s.averageRating.toFixed(1)}, ${s.goals} goals, ${s.assists} assists${best ? ", player of the season" : ""}`}
            >
              <span
                className={`relative flex h-11 w-11 items-center justify-center rounded-full border-2 bg-surface text-xs font-bold text-muted ${
                  best ? "border-accent ring-2 ring-accent/50" : "border-border"
                }`}
              >
                {slot.id}
                <RatingBadge rating={s.averageRating} className="absolute -right-3 -top-2 min-w-7 text-xs" />
              </span>
              <span className="max-w-24 truncate rounded bg-black/45 px-1.5 text-xs font-medium text-white">
                {surname(player.name)}
                {s.goals > 0 && <span className="ml-1 text-white/70">⚽{s.goals > 1 ? s.goals : ""}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
