// Turns a finished match (its result and events) into a replay "script": where
// the ball and the 22 players are at every moment, plus the event feed. Pure and
// deterministic — the same match always replays the same way — and it only acts
// out what the engine already decided, so a replay can never change a result.
//
// Time is measured in seconds of match time from kick-off, including stoppage
// time; the renderer decides how fast to play it.
//
// Pitch coordinates are metres on a 105 × 68 pitch. The home side defends the
// left goal (x = 0) and attacks right; the away side the opposite.

import type { FormationSlot } from "@/lib/data/types";
import type { MatchClock, MatchResult, ShotEvent, Side } from "@/lib/engine/match";
import { stableRandom } from "@/lib/engine/ratings";
import type { TeamProfile } from "@/lib/engine/team";
import { createRng, type Rng } from "@/lib/rng";

export const PITCH_LENGTH = 105;
export const PITCH_WIDTH = 68;
const GOAL_HALF_WIDTH = 3.66;

export interface ReplayPlayer {
  side: Side;
  index: number; // position in the team's line-up
  playerId: string;
  slot: string;
  isKeeper: boolean;
  baseX: number;
  baseY: number;
  phase: number; // for the idle drift, different per player
}

export type BallTarget = { kind: "player"; side: Side; index: number } | { kind: "point"; x: number; y: number };

export interface BallWaypoint {
  t: number;
  target: BallTarget;
}

// A stretch of play in which one side has the ball. `push` (0–1) is how far
// forward it pushes; the other side drops back a little.
export interface PossessionSpan {
  from: number;
  to: number;
  side: Side;
  push: number;
}

export interface Period {
  label: string; // "1st half", "2nd half", "Extra time 1", "Extra time 2"
  start: number; // seconds
  end: number;
  firstMinute: number; // 1, 46, 91, 106
  lastMinute: number; // 45, 90, 105, 120
}

export interface FeedItem {
  t: number;
  clock: MatchClock;
  kind: "goal" | "save" | "post" | "wide" | "missed-penalty";
  side: Side;
  shot: ShotEvent;
  score: { home: number; away: number }; // after this event
}

export interface ReplayScript {
  players: ReplayPlayer[];
  waypoints: BallWaypoint[]; // in time order
  possession: PossessionSpan[];
  periods: Period[];
  feed: FeedItem[];
  duration: number; // seconds, end of the last period
}

// ---------------------------------------------------------------------------
// Positions

// The formation slot coordinates (pitch_x across, pitch_y from attack 0 to own goal 100)
// as metres on the pitch, for each side.
export function basePosition(pitchX: number, pitchY: number, side: Side): { x: number; y: number } {
  const x = 4 + (100 - pitchY) * 0.47;
  const y = 4 + pitchX * 0.6;
  return side === "home" ? { x, y } : { x: PITCH_LENGTH - x, y: PITCH_WIDTH - y };
}

const ATTACK_DIRECTION: Record<Side, number> = { home: 1, away: -1 };
const PUSH_METRES = 17; // how far a side moves up at full push
const RAMP_SECONDS = 4; // how long a side takes to push up or drop back

// How far `side` is pushed forward at time t (−0.6 … 1).
export function pushAt(script: ReplayScript, side: Side, t: number): number {
  const spans = script.possession;
  let i = spans.findIndex((s) => t >= s.from && t < s.to);
  if (i < 0) i = t < (spans[0]?.from ?? 0) ? 0 : spans.length - 1;
  const value = (span: PossessionSpan | undefined) => (!span ? 0 : span.side === side ? span.push : -0.6 * span.push);
  const now = value(spans[i]);
  const before = value(spans[i - 1]);
  const ramp = Math.min(1, (t - (spans[i]?.from ?? 0)) / RAMP_SECONDS);
  return before + (now - before) * Math.max(0, ramp);
}

export function playerPosition(script: ReplayScript, player: ReplayPlayer, t: number): { x: number; y: number } {
  const push = pushAt(script, player.side, t) * (player.isKeeper ? 0.25 : 1);
  const drift = player.isKeeper ? 0.6 : 1.8;
  const x = player.baseX + ATTACK_DIRECTION[player.side] * push * PUSH_METRES + Math.sin(t * 0.5 + player.phase) * drift;
  const y = player.baseY + Math.cos(t * 0.37 + player.phase * 1.7) * drift;
  return { x: clamp(x, 1, PITCH_LENGTH - 1), y: clamp(y, 1, PITCH_WIDTH - 1) };
}

function resolve(script: ReplayScript, target: BallTarget, t: number): { x: number; y: number } {
  if (target.kind === "point") return { x: target.x, y: target.y };
  const player = script.players.find((p) => p.side === target.side && p.index === target.index)!;
  return playerPosition(script, player, t);
}

export function ballPosition(script: ReplayScript, t: number): { x: number; y: number } {
  const w = script.waypoints;
  if (w.length === 0) return { x: PITCH_LENGTH / 2, y: PITCH_WIDTH / 2 };
  if (t <= w[0].t) return resolve(script, w[0].target, t);
  for (let i = 0; i < w.length - 1; i++) {
    if (t < w[i + 1].t) {
      // The ball stays with whoever has it (a player carries it; a ball in the
      // net stays there), then travels in the last moment before the next
      // waypoint — so a shot arrives exactly when the event happens.
      const travel = Math.min(1.4, w[i + 1].t - w[i].t);
      const leave = w[i + 1].t - travel;
      if (t < leave) return resolve(script, w[i].target, t);
      const from = resolve(script, w[i].target, leave);
      const to = resolve(script, w[i + 1].target, w[i + 1].t);
      const k = clamp((t - leave) / travel, 0, 1);
      const eased = 1 - (1 - k) * (1 - k);
      return { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased };
    }
  }
  return resolve(script, w[w.length - 1].target, t);
}

// ---------------------------------------------------------------------------
// Clock

function periodsOf(result: MatchResult): Period[] {
  const st = result.stoppageTime;
  const defs: [string, number, number, number | null][] = [
    ["1st half", 1, 45, st.firstHalf],
    ["2nd half", 46, 90, st.secondHalf],
    ["Extra time 1", 91, 105, st.extraTimeFirstHalf],
    ["Extra time 2", 106, 120, st.extraTimeSecondHalf],
  ];
  const periods: Period[] = [];
  let start = 0;
  for (const [label, firstMinute, lastMinute, added] of defs) {
    if (added === null) break;
    const end = start + (lastMinute - firstMinute + 1 + added) * 60;
    periods.push({ label, start, end, firstMinute, lastMinute });
    start = end;
  }
  return periods;
}

// The scoreboard clock at time t (90+3' is { minute: 90, addedTime: 3 }).
export function clockAt(script: ReplayScript, t: number): MatchClock {
  const p = script.periods.find((q) => t < q.end) ?? script.periods[script.periods.length - 1];
  const elapsed = Math.floor((clamp(t, p.start, p.end - 1) - p.start) / 60);
  const regular = p.lastMinute - p.firstMinute;
  if (elapsed <= regular) return { minute: p.firstMinute + elapsed, addedTime: 0 };
  return { minute: p.lastMinute, addedTime: elapsed - regular };
}

// The moment within a period that an event's clock refers to (plus `second`).
function timeOfClock(periods: Period[], clock: MatchClock, second: number): number {
  const p = periods.find((q) => clock.minute >= q.firstMinute && clock.minute <= q.lastMinute)!;
  const minutesIn = clock.addedTime > 0 ? p.lastMinute - p.firstMinute + clock.addedTime : clock.minute - p.firstMinute;
  return p.start + minutesIn * 60 + second;
}

// ---------------------------------------------------------------------------
// Building the script

// `slots` are the formation slots (from formation_slots.csv), for player positions.
export function buildReplay(
  result: MatchResult,
  home: TeamProfile,
  away: TeamProfile,
  slots: FormationSlot[],
  matchKey: string,
): ReplayScript {
  const rng = createRng(Math.floor(stableRandom(`replay|${matchKey}`) * 2 ** 32));
  const teams = { home, away };
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const players: ReplayPlayer[] = (["home", "away"] as const).flatMap((side) =>
    teams[side].players.map((p, index) => {
      const slot = p.slot;
      const formationSlot = slotById.get(slot);
      if (!formationSlot) throw new Error(`Unknown formation slot "${slot}"`);
      const base = basePosition(formationSlot.pitchX, formationSlot.pitchY, side);
      return {
        side,
        index,
        playerId: p.player.id,
        slot,
        isKeeper: p.isKeeperSlot,
        baseX: base.x,
        baseY: base.y,
        phase: stableRandom(`${matchKey}|${side}|${p.player.id}`) * Math.PI * 2,
      };
    }),
  );
  const periods = periodsOf(result);
  const script: ReplayScript = { players, waypoints: [], possession: [], periods, feed: [], duration: periods.at(-1)!.end };

  const indexOf = (side: Side, playerId: string) => teams[side].players.findIndex((p) => p.player.id === playerId);
  const keeperIndex = (side: Side) => teams[side].players.findIndex((p) => p.isKeeperSlot);
  const outfield = (side: Side) => teams[side].players.map((_, i) => i).filter((i) => i !== keeperIndex(side));
  const other = (side: Side): Side => (side === "home" ? "away" : "home");
  // Waypoints are only ever added in time order, so the ball's path can't double back.
  const add = (t: number, target: BallTarget) => {
    const last = script.waypoints.at(-1);
    if (!last || t > last.t + 0.05) script.waypoints.push({ t, target });
  };
  const pass = (t: number, side: Side, index: number) => add(t, { kind: "player", side, index });
  const point = (t: number, x: number, y: number) => add(t, { kind: "point", x, y });
  const goalX = (attacking: Side) => (attacking === "home" ? PITCH_LENGTH : 0);

  const timed = placeShots(result.events.filter((e): e is ShotEvent => e.type === "shot"), periods, rng);

  const score = { home: 0, away: 0 };
  let kickoffSide: Side = rng.next() < 0.5 ? "home" : "away";

  for (const period of periods) {
    const events = timed.filter((x) => x.t >= period.start && x.t < period.end);
    // Kick-off from the centre spot.
    point(period.start, PITCH_LENGTH / 2, PITCH_WIDTH / 2);
    pass(period.start + 1, kickoffSide, randomOf(rng, outfield(kickoffSide)));
    kickoffSide = other(kickoffSide);
    let free = period.start + 2; // play is free to continue from here

    events.forEach(({ shot, t }, i) => {
      const side = shot.side;
      const defending = other(side);
      const nextT = events[i + 1]?.t ?? period.end;

      // Ordinary play, then the build-up (up to 14 seconds, shorter if events are close together).
      const buildStart = Math.max(free, t - 14);
      filler(free, buildStart);
      script.possession.push({ from: buildStart, to: t + 1.5, side, push: 1 });
      if (t - buildStart > 7) pass(buildStart, side, randomOf(rng, outfield(side)));
      if (shot.source === "corner" && t - buildStart > 3) {
        const top = rng.next() < 0.5;
        point(t - 3, goalX(side) === 0 ? 0.6 : PITCH_LENGTH - 0.6, top ? 0.6 : PITCH_WIDTH - 0.6);
      } else if (shot.assistId && t - buildStart > 4) {
        pass(t - 4, side, indexOf(side, shot.assistId));
      }
      pass(t - Math.min(1.6, (t - buildStart) / 2), side, indexOf(side, shot.shooterId));

      // The shot, then what happens next — squeezed in before the next event.
      const room = nextT - t - 1.5;
      const after = (wanted: number) => t + Math.max(0.6, Math.min(wanted, room));
      const yAim = PITCH_WIDTH / 2 + (rng.next() * 2 - 1) * (GOAL_HALF_WIDTH - 0.6);
      const gx = goalX(side);
      if (shot.outcome === "goal") {
        score[side]++;
        point(t, gx + (gx === 0 ? -1.2 : 1.2), yAim);
        const end = after(9); // celebrations, then kick-off
        if (end - t > 4) point(end - 1, PITCH_LENGTH / 2, PITCH_WIDTH / 2);
        pass(end, defending, randomOf(rng, outfield(defending)));
        script.possession.push({ from: t + 1.5, to: end, side: defending, push: 0 });
        free = end;
      } else if (shot.outcome === "saved") {
        pass(t, defending, keeperIndex(defending));
        free = after(4);
        pass(free, defending, randomOf(rng, outfield(defending)));
      } else if (shot.outcome === "post") {
        const postY = PITCH_WIDTH / 2 + (rng.next() < 0.5 ? -1 : 1) * GOAL_HALF_WIDTH;
        point(t, gx, postY);
        point(after(0.8), gx + (gx === 0 ? 7 : -7), postY + (rng.next() * 2 - 1) * 6);
        free = after(4);
        pass(free, defending, randomOf(rng, outfield(defending)));
      } else {
        const wideY = PITCH_WIDTH / 2 + (rng.next() < 0.5 ? -1 : 1) * (GOAL_HALF_WIDTH + 2 + rng.next() * 6);
        point(t, gx + (gx === 0 ? -2 : 2), wideY);
        free = after(4);
        pass(free, defending, keeperIndex(defending)); // goal kick
      }

      const kind: FeedItem["kind"] =
        shot.outcome === "goal"
          ? "goal"
          : shot.source === "penalty"
            ? "missed-penalty"
            : shot.outcome === "saved"
              ? "save"
              : shot.outcome === "post"
                ? "post"
                : "wide";
      script.feed.push({ t, clock: { minute: shot.minute, addedTime: shot.addedTime }, kind, side, shot, score: { ...score } });
    });
    filler(free, period.end);
  }

  script.possession.sort((a, b) => a.from - b.from);
  return script;

  // Ordinary play between events: one side keeps the ball for a while, passing
  // it around, then the other side wins it back.
  function filler(from: number, to: number) {
    let t = from;
    let side: Side = rng.next() < 0.5 ? "home" : "away";
    while (t < to - 2) {
      const spanEnd = Math.min(to, t + 6 + rng.next() * 10);
      script.possession.push({ from: t, to: spanEnd, side, push: 0.25 + rng.next() * 0.4 });
      for (let p = t + 0.2; p < spanEnd - 1; p += 2.5 + rng.next() * 2.5) pass(p, side, randomOf(rng, outfield(side)));
      t = spanEnd;
      side = other(side);
    }
  }
}

// When each shot happens, in seconds. Every shot stays inside its real minute,
// so the clock always matches. Within a minute, shots are spread out and a goal
// comes last; after a goal the next shot waits for the restart (at least 12
// seconds) when its own minute allows, otherwise the goal moves earlier.
const RESTART_AFTER_GOAL = 12;

function placeShots(shots: ShotEvent[], periods: Period[], rng: Rng): { shot: ShotEvent; t: number }[] {
  const byMinute = new Map<string, ShotEvent[]>();
  for (const shot of shots) {
    const key = `${shot.minute}+${shot.addedTime}`;
    byMinute.set(key, [...(byMinute.get(key) ?? []), shot]);
  }
  const placed: { shot: ShotEvent; t: number; minuteStart: number }[] = [];
  for (const group of byMinute.values()) {
    const minuteStart = timeOfClock(periods, group[0], 0);
    const ordered = [...group.filter((s) => s.outcome !== "goal"), ...group.filter((s) => s.outcome === "goal")];
    ordered.forEach((shot, k) => {
      const slot = 60 / (ordered.length + 1);
      const t = minuteStart + slot * (k + 1) + (rng.next() * 2 - 1) * slot * 0.3;
      placed.push({ shot, t, minuteStart });
    });
  }
  placed.sort((a, b) => a.t - b.t);

  // Leave time for the restart after each goal.
  for (let i = 1; i < placed.length; i++) {
    const prev = placed[i - 1];
    const cur = placed[i];
    const minGap = prev.shot.outcome === "goal" ? RESTART_AFTER_GOAL : 2;
    if (cur.t - prev.t >= minGap) continue;
    cur.t = Math.min(prev.t + minGap, cur.minuteStart + 59.5);
    if (cur.t - prev.t < minGap) {
      // No room later in this minute: move the earlier shot back within its own minute.
      const floor = Math.max(prev.minuteStart + 0.5, (placed[i - 2]?.t ?? -Infinity) + 0.5);
      prev.t = Math.max(floor, cur.t - minGap);
    }
  }
  return placed.map(({ shot, t }) => ({ shot, t }));
}

function randomOf(rng: Rng, items: number[]): number {
  return items[Math.floor(rng.next() * items.length)];
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
