"use client";

// The season hub: next match, last result, league table, results and scorers,
// and the perfect-season tracker. Sized to the window like the draft room.

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { DevPanel } from "@/components/DevPanel";
import { PerfectTracker } from "@/components/PerfectTracker";
import { LastResultCard } from "@/components/season/LastResultCard";
import { LeagueTable } from "@/components/season/LeagueTable";
import { NextMatchCard, type TeamLine } from "@/components/season/NextMatchCard";
import { SeasonComplete } from "@/components/season/SeasonComplete";
import { formOf, lastMatchFor, latestMatchday, matchesOn, nextMatchFor, resultFor, xiRating } from "@/components/season/seasonView";
import { SidePanel } from "@/components/season/SidePanel";
import { useRequirePhase } from "@/components/useRequirePhase";
import { useSavedRun } from "@/components/useSavedRun";
import type { GameData } from "@/lib/data/types";
import { perfectSeason, perfectTrack } from "@/lib/playoffs/outcome";
import { PLAYOFF_TEAMS } from "@/lib/playoffs/playoffs";
import { lineupOf } from "@/lib/draft/draft";
import { buildTeam } from "@/lib/engine/team";
import { PHASE_ROUTES, playLeague, runPhase, startPlayoffs, userTeam } from "@/lib/run";
import { leagueTable, matchdayCount, teamRecord, topScorers } from "@/lib/season/season";

const SEASON_ROOM_HEIGHT = "max(100dvh - 14rem, 30rem)";

export function SeasonScreen({ data }: { data: GameData }) {
  const router = useRouter();
  const { run, update, clear } = useSavedRun();
  const ready = useRequirePhase(run, "season");
  const playersById = useMemo(() => new Map(data.players.map((p) => [p.id, p])), [data]);
  const draft = run?.draft;
  // Team profiles only depend on the draft, so build them once per draft.
  const profiles = useMemo(() => (draft ? draft.teams.map((_, i) => buildTeam(lineupOf(draft, i), data)) : []), [draft, data]);

  if (!ready || !run || !run.season) return null;
  const season = run.season;
  const me = userTeam(run);
  const names = run.draft.teams.map((t) => t.name);
  const table = leagueTable(season);
  const positionOf = (team: number) => table.findIndex((r) => r.team === team) + 1;
  const record = teamRecord(season, me);
  const marks = perfectTrack(season, run.playoffs, me);
  const progress = perfectSeason(season, run.playoffs, me);
  const firstDrop = marks.findIndex((m) => m === "dropped");
  const totalMatchdays = matchdayCount(season);
  const latest = latestMatchday(season);
  const next = nextMatchFor(season, me);
  const last = lastMatchFor(season, me);

  const line = (team: number): TeamLine => ({
    name: names[team],
    position: positionOf(team),
    rating: xiRating(profiles[team]),
    form: formOf(season, team),
    isUser: team === me,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-6 rounded-xl border border-border bg-surface px-5 py-3">
        <div className="text-sm tabular-nums text-muted">
          {next ? (
            <>
              Matchday <b className="text-foreground">{next.matchday}</b> of {totalMatchdays}
            </>
          ) : (
            <b className="text-foreground">All {totalMatchdays} matchdays played</b>
          )}{" "}
          · <b className="text-foreground">{record.won}W {record.drawn}D {record.lost}L</b>
        </div>
        <div className="flex items-center gap-3">
          <PerfectTracker marks={marks} />
          <span className="text-xs tabular-nums text-muted">
            {progress.alive ? (
              <>
                <b className="text-accent">{progress.wins}</b> of {progress.target} · perfect season alive
              </>
            ) : (
              `Perfect season ended on matchday ${firstDrop + 1}`
            )}
          </span>
        </div>
        <button
          type="button"
          disabled={!next}
          onClick={() => update(playLeague(run, data, "rest"))}
          className="rounded-full border border-border px-3 py-1 text-xs font-semibold hover:border-accent disabled:opacity-40"
        >
          Sim to end of season
        </button>
      </div>

      <div
        className="grid gap-6"
        style={{ height: `calc(${SEASON_ROOM_HEIGHT})`, gridTemplateColumns: "minmax(0, 21rem) minmax(0, 1fr) minmax(0, 22rem)" }}
      >
        <div className="flex min-h-0 flex-col gap-4">
          {next ? (
            <NextMatchCard
              matchday={next.matchday}
              home={line(next.home)}
              away={line(next.away)}
              onPlay={() => update(playLeague(run, data, "matchday"))}
            />
          ) : (
            <SeasonComplete
              position={positionOf(me)}
              record={record}
              qualified={positionOf(me) <= PLAYOFF_TEAMS}
              onContinue={() => {
                const moved = startPlayoffs(run);
                update(moved);
                router.push(PHASE_ROUTES[runPhase(moved)]);
              }}
            />
          )}
          <SidePanel
            latestMatchday={latest}
            matchesOn={(day) => matchesOn(season, day)}
            scorers={topScorers(season)}
            names={names}
            user={me}
            playersById={playersById}
          />
        </div>

        <LeagueTable rows={table} names={names} user={me} playoffPlaces={PLAYOFF_TEAMS} formOf={(t) => formOf(season, t)} />

        <div className="min-h-0 overflow-y-auto">
          {last ? (
            <LastResultCard
              matchday={last.matchday}
              homeName={names[last.home]}
              awayName={names[last.away]}
              userSide={last.home === me ? "home" : "away"}
              result={last.result!}
              outcome={resultFor(last, me)}
              playersById={playersById}
            />
          ) : (
            <section className="flex h-full items-center justify-center rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted">
              Your results will appear here after your first match.
            </section>
          )}
        </div>
      </div>
      <DevPanel data={data} run={run} update={update} clear={clear} />
    </div>
  );
}
