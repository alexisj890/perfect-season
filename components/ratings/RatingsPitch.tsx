// Both XIs on one horizontal pitch with their match ratings, FotMob-style:
// the home side on the left attacking right, the away side on the right
// attacking left. Positions come from formation_slots.csv.

import type { FormationSlot, Player } from "@/lib/data/types";
import type { PlayerRating } from "@/lib/engine/ratings";
import type { Side } from "@/lib/engine/match";
import { surname } from "@/components/draft/draftView";
import { HorizontalPitchMarkings } from "@/components/ui/HorizontalPitch";
import { RatingBadge } from "./RatingBadge";

interface Props {
  slots: FormationSlot[];
  home: PlayerRating[];
  away: PlayerRating[];
  userSide: Side;
  playersById: Map<string, Player>;
}

// Each half is 50% wide; keep markers a little in from the edges. Markers are
// placed with calc() offsets rather than a CSS transform: a transform would make
// each marker its own layer, so a later player's name could cover an earlier
// player's rating. Without it, names sit underneath and badges always on top.
const MARKER_WIDTH = 80; // px (w-20)
const SHIRT = 32; // px (h-8)

function position(slot: FormationSlot, side: Side) {
  const depth = (100 - slot.pitchY) * 0.45; // 0 at own goal … ~45 near halfway
  const across = 7 + slot.pitchX * 0.86;
  const x = side === "home" ? 3 + depth : 97 - depth;
  const y = side === "home" ? across : 100 - across;
  return { left: `calc(${x}% - ${MARKER_WIDTH / 2}px)`, top: `calc(${y}% - ${SHIRT / 2}px)` };
}

export function RatingsPitch({ slots, home, away, userSide, playersById }: Props) {
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const marker = (r: PlayerRating) => {
    const player = playersById.get(r.playerId)!;
    const isUser = r.side === userSide;
    return (
      <div
        key={`${r.side}-${r.playerId}`}
        className="absolute flex w-20 flex-col items-center"
        style={position(slotById.get(r.slot)!, r.side)}
      >
        <div className="relative z-10">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold ${
              isUser ? "border-accent bg-accent/90 text-accent-foreground" : "border-white/70 bg-slate-700 text-white"
            }`}
          >
            {r.slot}
          </span>
          <RatingBadge rating={r.rating} className="absolute -right-6 -top-2 z-20 shadow" />
          {r.motm && (
            <span className="absolute -left-3 -top-2 text-sm text-accent drop-shadow" title="Man of the Match">
              ★
            </span>
          )}
        </div>
        <span className="mt-0.5 max-w-20 truncate rounded bg-black/50 px-1 text-xs font-medium text-white">
          {surname(player.name)}
        </span>
        {(r.goals > 0 || r.assists > 0) && (
          <span className="text-xs leading-tight text-white drop-shadow" aria-label={`${r.goals} goals, ${r.assists} assists`}>
            {"⚽".repeat(r.goals)}
            {"👟".repeat(r.assists)}
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      className="relative mx-auto aspect-[105/68] max-w-full shrink-0 overflow-hidden rounded-xl border border-border"
      style={{ height: "min(50dvh, 34rem)" }}
      role="img"
      aria-label="Both line-ups with their match ratings"
    >
      <svg viewBox="0 0 105 68" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden="true">
        <HorizontalPitchMarkings />
      </svg>
      {home.map(marker)}
      {away.map(marker)}
    </div>
  );
}
