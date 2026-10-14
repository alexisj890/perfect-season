"use client";

// Player ratings for one match: both line-ups on a pitch, then each team's
// players best-rated first.

import type { RefObject } from "react";
import { Modal } from "@/components/ui/Modal";
import type { FormationSlot, Player } from "@/lib/data/types";
import type { MatchResult, Side } from "@/lib/engine/match";
import type { MatchRatings, PlayerRating } from "@/lib/engine/ratings";
import { RatingBadge } from "./RatingBadge";
import { RatingsPitch } from "./RatingsPitch";

interface Props {
  open: boolean;
  onClose: () => void;
  returnFocusTo?: RefObject<HTMLElement | null>;
  title: string; // e.g. "Matchday 17"
  homeName: string;
  awayName: string;
  userSide: Side;
  result: MatchResult;
  ratings: MatchRatings;
  slots: FormationSlot[];
  playersById: Map<string, Player>;
}

export function MatchRatingsModal(props: Props) {
  const { open, onClose, returnFocusTo, title, homeName, awayName, userSide, result, ratings, slots, playersById } = props;
  const motm = playersById.get(ratings.motm);
  const teamClass = (side: Side) => (side === userSide ? "text-accent" : "");

  return (
    <Modal open={open} onClose={onClose} title={`Player ratings · ${title}`} returnFocusTo={returnFocusTo} wide>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
        <span className={`text-lg font-semibold ${teamClass("home")}`}>{homeName}</span>
        <span className="font-display text-4xl font-extrabold tabular-nums">
          {result.homeGoals}
          <span className="mx-1 text-muted">–</span>
          {result.awayGoals}
        </span>
        <span className={`text-lg font-semibold ${teamClass("away")}`}>{awayName}</span>
      </div>
      {motm && (
        <p className="text-center text-sm text-muted">
          <span className="text-accent">★</span> Man of the Match: <span className="font-semibold text-foreground">{motm.name}</span>
        </p>
      )}

      <RatingsPitch slots={slots} home={ratings.home} away={ratings.away} userSide={userSide} playersById={playersById} />

      <div className="grid grid-cols-2 gap-6">
        <RatingList name={homeName} ratings={ratings.home} playersById={playersById} highlight={userSide === "home"} />
        <RatingList name={awayName} ratings={ratings.away} playersById={playersById} highlight={userSide === "away"} />
      </div>
    </Modal>
  );
}

function RatingList({
  name,
  ratings,
  playersById,
  highlight,
}: {
  name: string;
  ratings: PlayerRating[];
  playersById: Map<string, Player>;
  highlight: boolean;
}) {
  const sorted = [...ratings].sort((a, b) => b.rating - a.rating);
  return (
    <section aria-label={`${name} ratings`}>
      <h3 className={`mb-1 text-sm font-semibold ${highlight ? "text-accent" : ""}`}>{name}</h3>
      <ol className="flex flex-col text-sm">
        {sorted.map((r) => (
          <li key={r.playerId} className="flex items-center gap-2 border-b border-border/50 py-1 last:border-b-0">
            <RatingBadge rating={r.rating} />
            <span className="min-w-0 flex-1 truncate">
              {playersById.get(r.playerId)?.name}
              {r.motm && <span className="ml-1 text-accent">★</span>}
            </span>
            <span className="text-xs text-muted">
              {"⚽".repeat(r.goals)}
              {"👟".repeat(r.assists)}
            </span>
            <span className="w-9 text-right text-xs text-muted">{r.slot}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
