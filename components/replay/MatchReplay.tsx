"use client";

// Plays a replay script: 22 dots and a ball on a pitch, a running clock and
// score, the event feed, and playback controls. It only draws the script —
// the result was decided by the engine before the replay started.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { MatchRatingsModal } from "@/components/ratings/MatchRatingsModal";
import { HorizontalPitchMarkings } from "@/components/ui/HorizontalPitch";
import type { FormationSlot, Player } from "@/lib/data/types";
import { formatClock, type MatchResult, type Side } from "@/lib/engine/match";
import type { MatchRatings } from "@/lib/engine/ratings";
import { advance, ballPosition, clockAt, playerPosition, type FeedItem, type ReplayScript } from "@/lib/replay/replay";

// Playback speed comes from the script (rateAt): attacks play close to real
// time, quiet spells fast, about 3 minutes per match at 1× (90 s at 2×, 45 s at 4×).
const SPEEDS = [1, 2, 4] as const;
const GOAL_PAUSE_MS = 1800;
const HALF_TIME_PAUSE_MS = 1500;

interface Props {
  script: ReplayScript;
  result: MatchResult;
  title: string;
  homeName: string;
  awayName: string;
  userSide: Side;
  playersById: Map<string, Player>;
  ratings: MatchRatings;
  slots: FormationSlot[];
  backHref: string;
}

export function MatchReplay(props: Props) {
  const { script, result, title, homeName, awayName, userSide, playersById, ratings, slots, backHref } = props;
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [banner, setBanner] = useState<string | null>(null);
  const [ratingsOpen, setRatingsOpen] = useState(false);
  const ratingsButton = useRef<HTMLButtonElement>(null);
  const finished = t >= script.duration;

  // The playback clock: advances t every animation frame, pausing briefly for
  // goals and at half-time.
  const state = useRef({ t: 0, holdUntil: 0 });
  useEffect(() => {
    if (!playing || finished) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const s = state.current;
      if (now >= s.holdUntil) {
        setBanner(null);
        const before = s.t;
        const after = advance(script, before, dt * speed);
        const goal = script.feed.find((f) => f.kind === "goal" && f.t > before && f.t <= after);
        const breakAt = script.periods.find((p, i) => i < script.periods.length - 1 && p.end > before && p.end <= after);
        if (goal) {
          s.t = goal.t + 0.1;
          s.holdUntil = now + GOAL_PAUSE_MS;
          setBanner(goalBanner(goal, playersById));
        } else if (breakAt) {
          s.t = breakAt.end;
          s.holdUntil = now + HALF_TIME_PAUSE_MS;
          setBanner(breakAt.label === "2nd half" ? "Full time — extra time next" : "Half-time");
        } else {
          s.t = after;
        }
        setT(s.t);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, finished, speed, script, playersById]);

  function seek(to: number) {
    state.current = { t: to, holdUntil: 0 };
    setBanner(null);
    setT(to);
  }

  const shown = script.feed.filter((f) => f.t <= t);
  const score = shown.filter((f) => f.kind === "goal").at(-1)?.score ?? { home: 0, away: 0 };
  const clock = finished ? null : clockAt(script, t);
  const keeperOf = useMemo(() => {
    const ids: Record<Side, string> = { home: "", away: "" };
    for (const p of script.players) if (p.isKeeper) ids[p.side] = p.playerId;
    return ids;
  }, [script]);
  const ball = ballPosition(script, t);
  const teamClass = (side: Side) => (side === userSide ? "text-accent" : "");

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 20rem)" }}>
      <div className="flex min-w-0 flex-col gap-3">
        {/* Scoreboard */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-xl border border-border bg-surface px-5 py-3">
          <span className={`truncate text-right text-lg font-semibold ${teamClass("home")}`}>{homeName}</span>
          <span className="flex flex-col items-center">
            <span className="font-display text-4xl font-extrabold tabular-nums" aria-live="polite">
              {score.home}–{score.away}
            </span>
            <span className="text-xs tabular-nums text-muted">{clock ? formatClock(clock) : result.extraTime ? "AET" : "FT"}</span>
          </span>
          <span className={`truncate text-lg font-semibold ${teamClass("away")}`}>{awayName}</span>
        </div>

        {/* Pitch */}
        <div
          className="relative mx-auto aspect-[105/68] max-w-full overflow-hidden rounded-xl border border-border"
          style={{ height: "calc(max(100dvh - 21rem, 18rem))" }}
        >
          <svg viewBox="-2 -1 109 70" className="absolute inset-0 h-full w-full" role="img" aria-label={`Replay of ${homeName} v ${awayName}`}>
            <HorizontalPitchMarkings />
            {script.players.map((p) => {
              const pos = playerPosition(script, p, t);
              const isUser = p.side === userSide;
              return (
                <circle
                  key={`${p.side}-${p.index}`}
                  cx={pos.x}
                  cy={pos.y}
                  r={1.7}
                  className={isUser ? (p.isKeeper ? "fill-amber-600" : "fill-accent") : p.isKeeper ? "fill-slate-400" : "fill-slate-700"}
                  stroke={isUser ? "#1a1400" : "white"}
                  strokeWidth={0.3}
                >
                  <title>{playersById.get(p.playerId)?.name}</title>
                </circle>
              );
            })}
            <ellipse cx={ball.x + 0.3} cy={ball.y + 0.5} rx={0.8} ry={0.4} fill="black" opacity={0.3} />
            <circle cx={ball.x} cy={ball.y} r={0.85} fill="white" stroke="#111" strokeWidth={0.2} />
          </svg>
          {banner && (
            <div className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center">
              <span className="rounded-xl bg-black/70 px-6 py-3 text-center text-2xl font-extrabold text-accent shadow-xl">{banner}</span>
            </div>
          )}
          {finished && (
            <FullTime
              result={result}
              homeName={homeName}
              awayName={awayName}
              userSide={userSide}
              playersById={playersById}
              onRatings={() => setRatingsOpen(true)}
              ratingsButton={ratingsButton}
              backHref={backHref}
            />
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => (finished ? seek(0) : setPlaying(!playing))}
            aria-label={finished ? "Watch again" : playing ? "Pause" : "Play"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
          >
            {finished ? "↺" : playing ? "❚❚" : "▶"}
          </button>
          <div className="flex rounded-full border border-border p-0.5" role="group" aria-label="Speed">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={speed === s}
                onClick={() => setSpeed(s)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${speed === s ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"}`}
              >
                {s}×
              </button>
            ))}
          </div>
          <ProgressBar script={script} t={t} userSide={userSide} onSeek={seek} />
          <button
            type="button"
            onClick={() => seek(script.duration)}
            disabled={finished}
            className="shrink-0 rounded-full border border-border px-3 py-1 text-xs font-semibold hover:border-accent disabled:opacity-40"
          >
            Skip to full time
          </button>
        </div>
      </div>

      {/* Event feed */}
      <section className="flex min-h-0 flex-col gap-2 rounded-xl border border-border bg-surface p-4" aria-label="Match events">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{title} · Match events</h2>
        <ol className="flex min-h-0 flex-col gap-1.5 overflow-y-auto text-sm" style={{ maxHeight: "calc(max(100dvh - 16rem, 20rem))" }}>
          {shown.length === 0 && <li className="text-muted">Kick-off…</li>}
          {[...shown].reverse().map((f, i) => (
            <li key={i} className={`flex gap-2 ${f.kind === "goal" ? "font-semibold" : "text-muted"}`}>
              <span className="w-12 shrink-0 tabular-nums">{formatClock(f.clock)}</span>
              <span className="min-w-0">
                <span className={teamClass(f.side)}>{feedText(f, playersById, keeperOf)}</span>
                {f.kind === "goal" && (
                  <span className="ml-1 text-xs font-normal tabular-nums text-muted">
                    ({f.score.home}–{f.score.away})
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {ratingsOpen && (
        <MatchRatingsModal
          open
          onClose={() => setRatingsOpen(false)}
          returnFocusTo={ratingsButton}
          title={title}
          homeName={homeName}
          awayName={awayName}
          userSide={userSide}
          result={result}
          ratings={ratings}
          slots={slots}
          playersById={playersById}
        />
      )}
    </div>
  );
}

function goalBanner(goal: FeedItem, playersById: Map<string, Player>): string {
  return `GOAL! ${playersById.get(goal.shot.shooterId)?.name ?? ""} ${formatClock(goal.clock)}`;
}

function feedText(f: FeedItem, playersById: Map<string, Player>, keeperOf: Record<Side, string>): string {
  const name = (id: string | null) => (id ? (playersById.get(id)?.name ?? id) : "");
  const shooter = name(f.shot.shooterId);
  switch (f.kind) {
    case "goal": {
      const how = f.shot.source === "penalty" ? " (pen)" : f.shot.source === "free kick" ? " (free kick)" : "";
      const assist = f.shot.assistId ? ` · assist ${name(f.shot.assistId)}` : "";
      return `⚽ ${shooter}${how}${assist}`;
    }
    case "save":
      return `🧤 ${name(keeperOf[f.side === "home" ? "away" : "home"])} saves from ${shooter}`;
    case "post":
      return `🥅 ${shooter} hits the woodwork`;
    case "missed-penalty":
      return `✗ ${shooter} misses a penalty`;
    case "wide":
      return `↗ ${shooter} shoots wide`;
  }
}

function ProgressBar({ script, t, userSide, onSeek }: { script: ReplayScript; t: number; userSide: Side; onSeek: (t: number) => void }) {
  return (
    <div
      className="relative h-2 min-w-0 flex-1 cursor-pointer rounded-full bg-surface-2"
      role="slider"
      aria-label="Match progress"
      aria-valuemin={0}
      aria-valuemax={Math.round(script.duration)}
      aria-valuenow={Math.round(t)}
      tabIndex={0}
      onClick={(e) => {
        const box = e.currentTarget.getBoundingClientRect();
        onSeek(((e.clientX - box.left) / box.width) * script.duration);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") onSeek(Math.min(script.duration, t + 120));
        if (e.key === "ArrowLeft") onSeek(Math.max(0, t - 120));
      }}
    >
      <div className="absolute inset-y-0 left-0 rounded-full bg-accent/60" style={{ width: `${(t / script.duration) * 100}%` }} />
      {script.feed
        .filter((f) => f.kind === "goal")
        .map((f, i) => (
          <span
            key={i}
            className={`absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-full ${f.side === userSide ? "bg-accent" : "bg-slate-300"}`}
            style={{ left: `${(f.t / script.duration) * 100}%` }}
            title={`Goal ${formatClock(f.clock)}`}
          />
        ))}
    </div>
  );
}

function FullTime(props: {
  result: MatchResult;
  homeName: string;
  awayName: string;
  userSide: Side;
  playersById: Map<string, Player>;
  onRatings: () => void;
  ratingsButton: React.RefObject<HTMLButtonElement | null>;
  backHref: string;
}) {
  const { result, homeName, awayName, userSide, playersById, onRatings, ratingsButton, backHref } = props;
  const mine = userSide === "home" ? result.homeGoals : result.awayGoals;
  const theirs = userSide === "home" ? result.awayGoals : result.homeGoals;
  const won = result.winner === userSide;
  const verdict = mine > theirs || (mine === theirs && won) ? "Win" : mine === theirs ? "Draw" : "Defeat";
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/55">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface px-8 py-6 text-center shadow-2xl">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted">{result.extraTime ? "After extra time" : "Full time"}</div>
        <div className="font-display text-5xl font-extrabold tabular-nums">
          {result.homeGoals}–{result.awayGoals}
        </div>
        <div className="text-sm text-muted">
          {homeName} v {awayName} · <span className="font-semibold text-foreground">{verdict}</span>
        </div>
        {result.shootout && (
          <div className="text-sm">
            <div className="font-semibold tabular-nums">
              Penalties {result.shootout.home}–{result.shootout.away}
            </div>
            <ol className="mt-1 flex flex-wrap justify-center gap-1 text-xs" aria-label="Penalty shootout">
              {result.shootout.kicks.map((k, i) => (
                <li key={i} className={`rounded px-1.5 py-0.5 ${k.side === userSide ? "bg-accent/20" : "bg-surface-2"}`}>
                  {k.outcome === "goal" ? "✓" : "✗"} {playersById.get(k.takerId)?.name.split(" ").at(-1)}
                </li>
              ))}
            </ol>
          </div>
        )}
        <div className="flex gap-2">
          <button
            ref={ratingsButton}
            type="button"
            onClick={onRatings}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-accent"
          >
            Player ratings
          </button>
          <Link href={backHref} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:brightness-110">
            Back to season
          </Link>
        </div>
      </div>
    </div>
  );
}
