"use client";

// /match/[id]: replays one of the user's played matches.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useLayoutEffect, useMemo, useState } from "react";
import { MatchReplay } from "@/components/replay/MatchReplay";
import { useSavedRun } from "@/components/useSavedRun";
import type { GameData } from "@/lib/data/types";
import { matchRatings } from "@/lib/engine/ratings";
import { buildReplay } from "@/lib/replay/replay";
import { findUserMatch, PHASE_ROUTES, runPhase } from "@/lib/run";

export function MatchScreen({ data }: { data: GameData }) {
  const { id } = useParams<{ id: string }>();
  const key = decodeURIComponent(id);
  const { run } = useSavedRun();
  const playersById = useMemo(() => new Map(data.players.map((p) => [p.id, p])), [data]);
  const match = useMemo(() => (run ? findUserMatch(run, data, key) : null), [run, data, key]);
  const script = useMemo(
    () => (match ? buildReplay(match.result, match.home, match.away, data.formation.slots, key) : null),
    [match, data, key],
  );
  const ratings = useMemo(() => (match ? matchRatings(match.result, match.home, match.away, key) : null), [match, key]);

  // Next.js keeps this page alive in the background; start the replay from
  // kick-off again when it's shown next time, rather than where it was left.
  const [visit, setVisit] = useState(0);
  useLayoutEffect(() => () => setVisit((v) => v + 1), []);

  const backHref = run ? PHASE_ROUTES[runPhase(run)] : "/";
  if (!match || !script || !ratings) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-2xl font-bold">Match not found</h1>
        <p className="text-muted">This match hasn&apos;t been played yet, or it isn&apos;t one of yours.</p>
        <Link href={backHref} className="text-accent underline underline-offset-4">
          Back
        </Link>
      </section>
    );
  }

  return (
    <MatchReplay
      key={`${key}-${visit}`}
      script={script}
      result={match.result}
      title={match.title}
      homeName={match.homeName}
      awayName={match.awayName}
      userSide={match.userSide}
      playersById={playersById}
      ratings={ratings}
      slots={data.formation.slots}
      backHref={backHref}
    />
  );
}
