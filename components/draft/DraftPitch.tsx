"use client";

// The user's XI on a pitch, using the formation coordinates from
// formation_slots.csv. Filled slots show the player; open slots are dashed.
// When a player is selected, open slots show his fit and rating there and
// become clickable.

import type { FormationSlot, Player, SlotId } from "@/lib/data/types";
import { displayRating, FIT_STYLE, surname, type SlotOption } from "./draftView";

interface Props {
  slots: FormationSlot[];
  lineup: Partial<Record<SlotId, { player: Player; rating: number }>>;
  options: SlotOption[] | null; // for the selected player, or null
  canPick: boolean;
  onPick: (slot: SlotId) => void;
}

// The pitch is drawn 100 wide × 130 tall. Slots are pulled slightly inward from
// the CSV coordinates so the labels under the keeper and wingers aren't clipped.
const HEIGHT = 130;
const inset = (n: number, margin: number) => margin + (n * (100 - 2 * margin)) / 100;

export function DraftPitch({ slots, lineup, options, canPick, onPick }: Props) {
  const optionFor = new Map(options?.map((o) => [o.slot, o]));

  return (
    <div className="relative aspect-[100/130] h-full w-full overflow-hidden rounded-2xl border border-border">
      <svg viewBox={`0 0 100 ${HEIGHT}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
        <rect width={100} height={HEIGHT} className="fill-pitch" />
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} y={i * 13} width={100} height={6.5} fill="white" opacity={0.035} />
        ))}
        <g className="stroke-pitch-line" fill="none" strokeWidth={0.4} opacity={0.7}>
          <rect x={3} y={3} width={94} height={HEIGHT - 6} />
          <line x1={3} y1={HEIGHT / 2} x2={97} y2={HEIGHT / 2} />
          <circle cx={50} cy={HEIGHT / 2} r={11} />
          <rect x={22} y={3} width={56} height={18} />
          <rect x={22} y={HEIGHT - 21} width={56} height={18} />
          <rect x={36} y={3} width={28} height={7} />
          <rect x={36} y={HEIGHT - 10} width={28} height={7} />
        </g>
      </svg>

      {slots.map((slot) => {
        const filled = lineup[slot.id];
        const option = optionFor.get(slot.id);
        const clickable = canPick && !!option && !filled;
        const fit = option ? FIT_STYLE[option.fit] : null;
        return (
          <div
            key={slot.id}
            className="absolute flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
            style={{ left: `${inset(slot.pitchX, 6)}%`, top: `${inset(slot.pitchY, 6)}%` }}
          >
            <button
              type="button"
              disabled={!clickable}
              onClick={() => onPick(slot.id)}
              aria-label={
                filled
                  ? `${slot.id}: ${filled.player.name}, ${displayRating(filled.rating)}`
                  : option
                    ? `Draft into ${slot.id}: ${fit!.label}, rating ${displayRating(option.rating)}`
                    : `${slot.id}: open`
              }
              className={`flex h-12 w-12 items-center justify-center rounded-full border-2 text-sm font-bold tabular-nums ${
                filled
                  ? "border-accent bg-surface text-foreground"
                  : option
                    ? `${fit!.className} bg-surface/90 ${clickable ? "cursor-pointer hover:scale-110" : ""}`
                    : "border-dashed border-white/60 bg-black/15 text-white/80"
              }`}
            >
              {filled ? displayRating(filled.rating) : option ? displayRating(option.rating) : slot.id}
            </button>
            <span className="max-w-24 truncate rounded bg-black/45 px-1.5 text-xs font-medium text-white">
              {filled ? surname(filled.player.name) : option ? fit!.short : slot.id}
            </span>
          </div>
        );
      })}
    </div>
  );
}
