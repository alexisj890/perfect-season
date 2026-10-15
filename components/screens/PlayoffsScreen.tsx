"use client";

// The playoffs: the bracket, what's up next (Play / Watch / Sim to the end),
// the user's knockout results with replays, and the perfect-season tracker.

import { useRouter } from "next/navigation";
import { DevPanel } from "@/components/DevPanel";
import { HonoursStatus } from "@/components/HonoursStatus";
import { PerfectTracker } from "@/components/PerfectTracker";
import { Bracket } from "@/components/playoffs/Bracket";
import { UpNext } from "@/components/playoffs/UpNext";
import { YourPath } from "@/components/playoffs/YourPath";
import { useRequirePhase } from "@/components/useRequirePhase";
import { useSavedRun } from "@/components/useSavedRun";
import type { GameData } from "@/lib/data/types";
import { perfectTrack, runOutcome } from "@/lib/playoffs/outcome";
import { champion, nextStep, nextUserMatch, playoffMatches, tieWinner } from "@/lib/playoffs/playoffs";
import { endRun, PHASE_ROUTES, playPlayoffs, runPhase, userTeam } from "@/lib/run";

const PLAYOFFS_HEIGHT = "max(100dvh - 14rem, 30rem)";

export function PlayoffsScreen({ data }: { data: GameData }) {
  const router = useRouter();
  const { run, update, clear } = useSavedRun();
  const ready = useRequirePhase(run, "playoffs");
  if (!ready || !run || !run.season || !run.playoffs) return null;

  const playoffs = run.playoffs;
  const me = userTeam(run);
  const names = run.draft.teams.map((t) => t.name);
  const step = nextStep(playoffs);
  const userMatch = nextUserMatch(playoffs, me);
  const marks = perfectTrack(run.season, playoffs, me);
  const outcome = runOutcome(run.season, playoffs, me);
  const winner = champion(playoffs);
  const myMatches = playoffMatches(playoffs).filter((m) => m.result && (m.home === me || m.away === me));

  // Who knocked the user out, if anyone.
  const lostTie = [...playoffs.quarterFinals, ...playoffs.semiFinals].find(
    (t) => (t.higher === me || t.lower === me) && tieWinner(t) !== null && tieWinner(t) !== me,
  );
  const lostFinal = playoffs.final?.result && winner !== me && (playoffs.final.home === me || playoffs.final.away === me);
  const knockedOutBy = lostTie ? names[tieWinner(lostTie)!] : lostFinal ? names[winner!] : null;

  const finish = () => {
    const ended = endRun(run, data);
    update(ended);
    router.push(PHASE_ROUTES[runPhase(ended)]);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-6 rounded-xl border border-border bg-surface px-5 py-3">
        <div className="text-sm text-muted">
          <b className="text-foreground">Playoffs</b> ·{" "}
          {outcome.kind === "champion"
            ? outcome.perfect
              ? "Champions · Perfect season"
              : outcome.invincible
                ? "Champions · Invincible season"
                : "Champions!"
            : lostFinal
              ? "Runners-up"
              : knockedOutBy
                ? "Knocked out"
                : step
                  ? "Still in it"
                  : "Complete"}
        </div>
        <div className="flex items-center gap-3">
          <PerfectTracker marks={marks} />
          <HonoursStatus season={run.season} playoffs={playoffs} user={me} matchIndexOfFirstLoss={marks.indexOf("loss")} />
        </div>
      </div>

      <div className="grid gap-6" style={{ height: `calc(${PLAYOFFS_HEIGHT})`, gridTemplateColumns: "minmax(0, 20rem) minmax(0, 1fr)" }}>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <UpNext
            step={step}
            userMatch={userMatch}
            names={names}
            user={me}
            knockedOutBy={knockedOutBy}
            championName={winner !== null ? names[winner] : null}
            userIsChampion={winner === me}
            honour={outcome.kind === "champion" ? (outcome.perfect ? "perfect" : outcome.invincible ? "invincible" : null) : null}
            onPlay={() => update(playPlayoffs(run, data, "step"))}
            onWatch={() => {
              // Play the step (results are decided now), then watch the user's match.
              update(playPlayoffs(run, data, "step"));
              router.push(`/match/${userMatch!.key}`);
            }}
            onSimRest={() => update(playPlayoffs(run, data, "rest"))}
            onFinish={finish}
          />
          <YourPath matches={myMatches} names={names} user={me} />
        </div>
        <div className="min-h-0 overflow-y-auto rounded-xl border border-border bg-surface/40 p-4">
          <Bracket state={playoffs} names={names} user={me} />
        </div>
      </div>
      <DevPanel data={data} run={run} update={update} clear={clear} />
    </div>
  );
}
