"use client";

// The end of a run: how it finished (Champions with the trophy, Better luck
// next time, or Relegated), the Perfect / Invincible honours, the 35 dots, the
// league finish and knockout path, and the XI with their season ratings.

import Link from "next/link";
import { useMemo } from "react";
import { DevPanel } from "@/components/DevPanel";
import { endHeadline } from "@/components/end/endView";
import { SeasonXI } from "@/components/end/SeasonXI";
import { Trophy } from "@/components/end/Trophy";
import { PerfectTracker } from "@/components/PerfectTracker";
import { YourPath } from "@/components/playoffs/YourPath";
import { RatingBadge } from "@/components/ratings/RatingBadge";
import { ordinal } from "@/components/season/NextMatchCard";
import { SquadList } from "@/components/season/SidePanel";
import { useRequirePhase } from "@/components/useRequirePhase";
import { useSavedRun } from "@/components/useSavedRun";
import type { GameData, Player } from "@/lib/data/types";
import { runRecap, type RunRecap } from "@/lib/end/recap";
import type { SeasonPlayerStats } from "@/lib/engine/ratings";
import { DIFFICULTY_LABEL } from "@/lib/run";

const END_ROOM_HEIGHT = "max(100dvh - 22rem, 26rem)";

export function EndScreen({ data }: { data: GameData }) {
  const { run, update, clear } = useSavedRun();
  const ready = useRequirePhase(run, "finished");
  const playersById = useMemo(() => new Map(data.players.map((p) => [p.id, p])), [data]);
  const recap = useMemo(() => (ready && run ? runRecap(run, data) : null), [ready, run, data]);
  if (!ready || !run || !recap) return null;

  const headline = endHeadline(recap);
  const name = (id: string) => playersById.get(id)?.name ?? id;

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label="How it ended"
        className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-8 rounded-2xl border bg-surface px-8 py-6 ${
          headline.champion ? "border-accent" : "border-border"
        }`}
      >
        <Trophy won={headline.champion} className={`h-28 w-24 ${headline.champion ? "text-accent" : "text-muted"}`} />
        <div className="flex min-w-0 flex-col gap-2">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted">
            {recap.teamName} · {headline.kicker} · {DIFFICULTY_LABEL[run.difficulty]}
          </div>
          {/* For a Perfect or Invincible season, the honour is the title. */}
          <h1 className="font-display text-5xl font-extrabold leading-none">{headline.title}</h1>
          {headline.lines.map((line) => (
            <p key={line} className="text-muted">
              {line}
            </p>
          ))}
          <div className="mt-1 flex items-center gap-3 text-xs tabular-nums text-muted">
            <PerfectTracker marks={recap.marks} />
            <span>
              <b className="text-foreground">
                {recap.overall.won}W {recap.overall.drawn}D {recap.overall.lost}L
              </b>{" "}
              in {recap.overall.played} matches
            </span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Link href="/new" className="rounded-full bg-accent px-6 py-3 font-semibold text-accent-foreground hover:brightness-110">
            {headline.honour === "perfect" ? "Start a new run" : "Try again"}
          </Link>
          <Link href="/" className="text-sm text-muted underline underline-offset-4 hover:text-foreground">
            Back to home
          </Link>
        </div>
      </section>

      <div className="grid gap-6" style={{ height: `calc(${END_ROOM_HEIGHT})`, gridTemplateColumns: "minmax(0, 20rem) minmax(0, 1fr) minmax(0, 22rem)" }}>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <LeagueFinish recap={recap} />
          {recap.knockouts.length > 0 && <YourPath matches={recap.knockouts} names={recap.names} user={recap.user} />}
        </div>

        <div className="flex min-h-0 justify-center">
          <SeasonXI
            slots={data.formation.slots}
            squad={recap.squad}
            playersById={playersById}
            bestId={recap.playerOfTheSeason?.playerId ?? null}
          />
        </div>

        <div className="flex min-h-0 flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Award title="Player of the season" stats={recap.playerOfTheSeason} name={name} playersById={playersById} />
            <Award title="Top scorer" stats={recap.topScorer} name={name} playersById={playersById} goals />
          </div>
          <section className="flex min-h-0 flex-1 flex-col gap-2 rounded-xl border border-border bg-surface p-4" aria-label="Season ratings">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Season ratings</h3>
            <SquadList squad={recap.squad} playersById={playersById} />
          </section>
        </div>
      </div>
      <DevPanel data={data} run={run} update={update} clear={clear} />
    </div>
  );
}

function LeagueFinish({ recap }: { recap: RunRecap }) {
  const l = recap.league;
  const cells: [string, number | string][] = [
    ["P", l.played],
    ["W", l.won],
    ["D", l.drawn],
    ["L", l.lost],
    ["GD", l.goalDifference > 0 ? `+${l.goalDifference}` : l.goalDifference],
    ["Pts", l.points],
  ];
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4" aria-label="League finish">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">League</h3>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-4xl font-extrabold tabular-nums">{ordinal(l.position)}</span>
        <span className="text-sm text-muted">of {l.teams}</span>
      </div>
      <dl className="grid grid-cols-6 gap-1 text-center text-xs tabular-nums">
        {cells.map(([label, value]) => (
          <div key={label} className="flex flex-col">
            <dt className="text-muted">{label}</dt>
            <dd className="font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs tabular-nums text-muted">
        {l.goalsFor} scored, {l.goalsAgainst} conceded
      </p>
    </section>
  );
}

function Award(props: {
  title: string;
  stats: SeasonPlayerStats | null;
  name: (id: string) => string;
  playersById: Map<string, Player>;
  goals?: boolean;
}) {
  const { title, stats, name, playersById, goals = false } = props;
  return (
    <section className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-3" aria-label={title}>
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {stats ? (
        <>
          <span className="truncate text-sm font-semibold">{name(stats.playerId)}</span>
          <span className="flex items-center gap-1.5 text-xs tabular-nums text-muted">
            {goals ? (
              <>
                <b className="text-foreground">{stats.goals}</b> goals · {stats.assists} assists
              </>
            ) : (
              <>
                <RatingBadge rating={stats.averageRating} /> {playersById.get(stats.playerId)?.club}
              </>
            )}
          </span>
        </>
      ) : (
        <span className="text-sm text-muted">—</span>
      )}
    </section>
  );
}
