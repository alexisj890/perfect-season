// Turns a finished match (its result and events) into a replay "script": where
// the ball and the 22 players are at every moment, plus the event feed and how
// fast to play each part. Pure and deterministic — the same match always replays
// the same way — and it only acts out what the engine already decided, so a
// replay can never change a result.
//
// Time is measured in seconds of match time from kick-off, including stoppage
// time. Like TV highlights, the script plays at two speeds: attacks (the
// build-up, the shot and what follows) run close to real time so passes, shots
// and saves are visible; the quiet spells in between run fast. The fast speed is
// chosen per match so a whole replay takes about TARGET_REAL_SECONDS at 1×.
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

// Playback (match seconds per real second at 1×).
export const SLOW_RATE = 4; // attacks: close to real time
export const TARGET_REAL_SECONDS = 180; // a whole match at 1×
const MIN_FAST_RATE = 20;
const MAX_FAST_RATE = 200;

export interface ReplayPlayer {
  side: Side;
  index: number; // position in the team's line-up
  playerId: string;
  slot: string;
  isKeeper: boolean;
  baseX: number;
  baseY: number;
  phase: number; // for the idle sway, different per player
}

export type BallTarget = { kind: "player"; side: Side; index: number } | { kind: "point"; x: number; y: number };

// The ball reaches `target` at time t, after travelling for `travel` seconds
// (it stays with whoever has it until then).
export interface BallWaypoint {
  t: number;
  target: BallTarget;
  travel: number;
  optional?: boolean; // an ordinary pass that can be dropped to make room
}

// A stretch of play in which one side has the ball. `push` (0–1) is how far
// forward it pushes; the other side drops back a little.
export interface PossessionSpan {
  from: number;
  to: number;
  side: Side;
  push: number;
  ramp: number; // seconds to ease into this span's push (longer in fast-played spells)
}

// A player running to a spot: arrives at `arrive`, holds until `until`, then
// drifts back to his position over `back` seconds. Used for shooters,
// assisters and diving keepers.
export interface Run {
  side: Side;
  index: number;
  from: number;
  arrive: number;
  until: number;
  back: number;
  x: number;
  y: number;
}

export interface Segment {
  from: number;
  to: number;
  rate: number; // match seconds per real second at 1×
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
  // "corner" marks the moment a corner is won (the ball deflects behind off a
  // defender); the others are shots.
  kind: "goal" | "save" | "post" | "wide" | "missed-penalty" | "corner";
  side: Side; // the attacking side
  shot: ShotEvent; // for a corner, the header that follows it
  score: { home: number; away: number }; // after this event
  attackerId?: string; // corner: whose effort was blocked
  blockerId?: string; // corner: the defender it came off
}

export interface ReplayScript {
  players: ReplayPlayer[];
  waypoints: BallWaypoint[]; // in time order
  possession: PossessionSpan[];
  runs: Run[];
  segments: Segment[]; // cover the whole match, in order
  periods: Period[];
  feed: FeedItem[];
  duration: number; // seconds, end of the last period
}

// ---------------------------------------------------------------------------
// Playback speed

export function rateAt(script: ReplayScript, t: number): number {
  return (script.segments.find((s) => t < s.to) ?? script.segments[script.segments.length - 1]).rate;
}

// Moves playback forward by `realSeconds` (at 1×) from match time t. Each part
// is played at its own speed: when a fast spell hands over to a slow attack
// mid-frame, the rest of the frame runs slowly — so the build-up isn't skipped.
export function advance(script: ReplayScript, t: number, realSeconds: number): number {
  let time = t;
  let left = realSeconds;
  while (left > 1e-9 && time < script.duration) {
    const seg = script.segments.find((s) => time < s.to) ?? script.segments[script.segments.length - 1];
    const toBoundary = (seg.to - time) / seg.rate; // real seconds to the end of this part
    if (left < toBoundary) return time + left * seg.rate;
    time = seg.to;
    left -= toBoundary;
  }
  return Math.min(time, script.duration);
}

// How long the whole replay takes at 1×, in real seconds.
export function realDuration(script: ReplayScript): number {
  return script.segments.reduce((sum, s) => sum + (s.to - s.from) / s.rate, 0);
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
const RAMP_SECONDS = 8; // how long a side takes to push up or drop back

// How far `side` is pushed forward at time t (−0.6 … 1). Each possession span
// eases from wherever the side actually is when it starts, so the value is
// continuous — overlapping or back-to-back spans never make a team jump.
export function pushAt(script: ReplayScript, side: Side, t: number): number {
  const spans = script.possession; // sorted by `from`
  let value = 0;
  for (let i = 0; i < spans.length && spans[i].from <= t; i++) {
    const span = spans[i];
    const target = span.side === side ? span.push : -0.6 * span.push;
    const until = Math.min(t, spans[i + 1]?.from ?? Infinity);
    const k = Math.min(1, Math.max(0, until - span.from) / span.ramp);
    value += (target - value) * k;
  }
  return value;
}

function runWeight(run: Run, t: number): number {
  if (t <= run.from || t >= run.until + run.back) return 0;
  if (t < run.arrive) return smooth((t - run.from) / Math.max(0.01, run.arrive - run.from));
  if (t <= run.until) return 1;
  return 1 - smooth((t - run.until) / run.back);
}

export function playerPosition(script: ReplayScript, player: ReplayPlayer, t: number): { x: number; y: number } {
  const push = pushAt(script, player.side, t) * (player.isKeeper ? 0.25 : 1);
  const sway = player.isKeeper ? 0.6 : 1.8;
  // A gentle sway (one cycle every couple of match minutes) so players don't stand still.
  let x = player.baseX + ATTACK_DIRECTION[player.side] * push * PUSH_METRES + Math.sin(t * 0.05 + player.phase) * sway;
  let y = player.baseY + Math.cos(t * 0.037 + player.phase * 1.7) * sway;
  // Runs (to a shooting spot, out wide, a tackle, or a keeper's dive) pull him off
  // his position. Each run blends from wherever the earlier ones left him (runs
  // are sorted by arrival), so one run handing over to the next never makes him jump.
  for (const run of script.runs) {
    if (run.side !== player.side || run.index !== player.index) continue;
    const w = runWeight(run, t);
    if (w === 0) continue;
    x += (run.x - x) * w;
    y += (run.y - y) * w;
  }
  return { x: clamp(x, 0.5, PITCH_LENGTH - 0.5), y: clamp(y, 0.5, PITCH_WIDTH - 0.5) };
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
      // The ball stays with whoever has it, then travels in the last moment
      // before the next waypoint — so a shot arrives exactly when it happens.
      const travel = Math.min(w[i + 1].travel, w[i + 1].t - w[i].t - 0.05);
      const leave = w[i + 1].t - travel;
      if (t < leave) return resolve(script, w[i].target, t);
      const from = resolve(script, w[i].target, leave);
      const to = resolve(script, w[i + 1].target, w[i + 1].t);
      const k = smooth(clamp((t - leave) / travel, 0, 1));
      return { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
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

const KICKOFF_WINDOW = 6; // seconds of slow play at each kick-off
const RUN_BACK_REAL = 1; // real seconds (at 1×) a player takes to get back into position after a run
const SPRINT = 8; // metres per match second: nobody runs faster than this
const BUILD_UP = 16; // seconds of build-up before a shot (less if events are close)
const AFTERMATH: Record<ShotEvent["outcome"], number> = { goal: 12, saved: 6, post: 6, wide: 6 };

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
      const formationSlot = slotById.get(p.slot);
      if (!formationSlot) throw new Error(`Unknown formation slot "${p.slot}"`);
      const base = basePosition(formationSlot.pitchX, formationSlot.pitchY, side);
      return {
        side,
        index,
        playerId: p.player.id,
        slot: p.slot,
        isKeeper: p.isKeeperSlot,
        baseX: base.x,
        baseY: base.y,
        phase: stableRandom(`${matchKey}|${side}|${p.player.id}`) * Math.PI * 2,
      };
    }),
  );
  const periods = periodsOf(result);
  const script: ReplayScript = {
    players,
    waypoints: [],
    possession: [],
    runs: [],
    segments: [],
    periods,
    feed: [],
    duration: periods.at(-1)!.end,
  };

  const indexOf = (side: Side, playerId: string) => teams[side].players.findIndex((p) => p.player.id === playerId);
  const keeperIndex = (side: Side) => teams[side].players.findIndex((p) => p.isKeeperSlot);
  const outfield = (side: Side) => teams[side].players.map((_, i) => i).filter((i) => i !== keeperIndex(side));
  const other = (side: Side): Side => (side === "home" ? "away" : "home");
  const goalX = (attacking: Side) => (attacking === "home" ? PITCH_LENGTH : 0);
  const towardGoal = (attacking: Side, metres: number) => goalX(attacking) - ATTACK_DIRECTION[attacking] * metres;
  const playerAt = (side: Side, index: number) => players.find((p) => p.side === side && p.index === index)!;

  // Waypoints are only ever added in time order, so the ball's path can't double
  // back. If an ordinary pass would leave the next movement too little time to
  // travel (so it would zip across the screen), that ordinary pass is dropped.
  const add = (t: number, target: BallTarget, travel: number, optional = false) => {
    const w = script.waypoints;
    while (w.length > 1 && w[w.length - 1].optional && t - w[w.length - 1].t < travel * 0.9) w.pop();
    const last = w.at(-1);
    if (last && t - last.t < travel * 0.9 && optional) return; // no room for this ordinary pass
    if (!last || t > last.t + 0.1) w.push({ t, target, travel, optional });
  };
  const pass = (t: number, side: Side, index: number, travel: number, optional = false) =>
    add(t, { kind: "player", side, index }, travel, optional);
  const point = (t: number, x: number, y: number, travel: number) => add(t, { kind: "point", x, y }, travel);
  const lastHolder = (): { side: Side; index: number } | null => {
    const target = script.waypoints.at(-1)?.target;
    return target?.kind === "player" ? { side: target.side, index: target.index } : null;
  };
  // Adds a run, limited to sprinting speed: if there isn't time to reach the spot,
  // the run starts earlier (but not before `earliest`), and if that still isn't
  // enough he stops short, as far as he can get.
  let earliest = 0;
  const addRun = (run: Run) => {
    const player = playerAt(run.side, run.index);
    // A player gets where he was going (to make a tackle, say) before starting a
    // new run — but he can leave a spot he was holding to make a fresh run.
    const busyUntil = script.runs
      .filter((r) => r.side === run.side && r.index === run.index && r.arrive <= run.arrive)
      .reduce((latest, r) => Math.max(latest, r.arrive), -Infinity);
    const from = Math.max(earliest, busyUntil, Math.min(run.from, run.arrive - 0.5));
    const start = playerPosition(script, player, from);
    const distance = Math.hypot(run.x - start.x, run.y - start.y);
    const needed = distance / SPRINT;
    const begin = Math.max(earliest, busyUntil, Math.min(from, run.arrive - needed));
    const reach = Math.min(1, ((run.arrive - begin) * SPRINT) / Math.max(distance, 0.01));
    const startAt = playerPosition(script, player, begin);
    script.runs.push({
      ...run,
      from: begin,
      x: startAt.x + (run.x - startAt.x) * reach,
      y: startAt.y + (run.y - startAt.y) * reach,
    });
  };

  // The opponent nearest to where the ball is, to intercept it.
  const nearestOpponent = (side: Side, t: number): number => {
    const at = ballPosition(script, t);
    let best = outfield(side)[0];
    let bestDistance = Infinity;
    for (const i of outfield(side)) {
      const pos = playerPosition(script, playerAt(side, i), t);
      const d = Math.hypot(pos.x - at.x, pos.y - at.y);
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    }
    return best;
  };

  // Winning the ball, the way it happens in a match rather than as a pass between
  // the teams: either a TACKLE (the nearest opponent closes down the player on
  // the ball and takes it off him) or an INTERCEPTION (the player on the ball
  // passes toward a teammate and an opponent steps into the lane to cut it out).
  // `rate` is the playback speed there, so the movement takes ~0.6 s on screen.
  const winBall = (time: number, side: Side, rate: number): void => {
    const holder = lastHolder();
    if (!holder || holder.side === side) {
      pass(time, side, randomOf(rng, outfield(side)), 0.45 * rate, true);
      return;
    }
    const lead = 0.6 * rate;
    const holderPlayer = playerAt(holder.side, holder.index);
    const holderPos = playerPosition(script, holderPlayer, time);
    const nearestTo = (spot: { x: number; y: number }) => {
      let best = outfield(side)[0];
      let bestDistance = Infinity;
      for (const i of outfield(side)) {
        const pos = playerPosition(script, playerAt(side, i), time - lead);
        const d = Math.hypot(pos.x - spot.x, pos.y - spot.y);
        if (d < bestDistance) {
          bestDistance = d;
          best = i;
        }
      }
      return best;
    };
    const savedEarliest = earliest;
    earliest = time - lead;
    let winner: number;
    let travel: number;
    if (rng.next() < 0.65) {
      // Tackle: the man on the ball and the nearest opponent meet halfway; the
      // ball changes feet there.
      winner = nearestTo(holderPos);
      const tacklerPos = playerPosition(script, playerAt(side, winner), time - lead);
      const meet = { x: (holderPos.x + tacklerPos.x) / 2, y: (holderPos.y + tacklerPos.y) / 2 };
      addRun({ back: RUN_BACK_REAL * rate, side: holder.side, index: holder.index, from: time - lead, arrive: time, until: time + 0.2 * rate, x: meet.x, y: meet.y });
      addRun({ back: RUN_BACK_REAL * rate, side, index: winner, from: time - lead, arrive: time, until: time + 0.3 * rate, x: meet.x, y: meet.y });
      travel = 0.12 * rate;
    } else {
      // Interception: a pass toward a teammate, cut out early in its path.
      const mates = outfield(holder.side).filter((i) => i !== holder.index);
      const mate = playerPosition(script, playerAt(holder.side, randomOf(rng, mates)), time);
      const along = 0.3 + rng.next() * 0.2;
      const spot = { x: holderPos.x + (mate.x - holderPos.x) * along, y: holderPos.y + (mate.y - holderPos.y) * along };
      winner = nearestTo(spot);
      addRun({ back: RUN_BACK_REAL * rate, side, index: winner, from: time - lead, arrive: time, until: time + 0.3 * rate, x: spot.x, y: spot.y });
      travel = 0.35 * rate;
    }
    earliest = savedEarliest;
    pass(time, side, winner, travel, true);
  };

  // 1. When each shot happens, and the window of slow play around it.
  const timed = placeShots(
    result.events.filter((e): e is ShotEvent => e.type === "shot"),
    periods,
    rng,
  );
  // `stretch` is where the unbroken run of slow play containing this attack
  // began (back-to-back attacks share one), so runs can start that early.
  type Plan = { shot: ShotEvent; t: number; from: number; to: number; stretch: number };
  const plansByPeriod: Plan[][] = periods.map((period) => {
    const events = timed.filter((x) => x.t >= period.start && x.t < period.end);
    const plans: Plan[] = [];
    let free = period.start + KICKOFF_WINDOW;
    events.forEach(({ shot, t }, i) => {
      const nextT = events[i + 1]?.t ?? period.end;
      const from = Math.max(free, t - BUILD_UP);
      const to = t + Math.max(0.8, Math.min(AFTERMATH[shot.outcome], nextT - t - 1.5));
      const previous = plans.at(-1);
      const contiguous = previous ? from <= previous.to + 0.01 : from <= period.start + KICKOFF_WINDOW + 0.01;
      const stretch = contiguous ? (previous?.stretch ?? period.start) : from;
      plans.push({ shot, t, from, to, stretch });
      free = to;
    });
    return plans;
  });

  // 2. Playback speed: slow for kick-offs and attacks, fast in between, so the
  //    whole match takes about TARGET_REAL_SECONDS at 1×.
  const slow: [number, number][] = [];
  periods.forEach((period, i) => {
    slow.push([period.start, period.start + KICKOFF_WINDOW]);
    for (const p of plansByPeriod[i]) slow.push([p.from, p.to]);
  });
  const slowTotal = slow.reduce((sum, [a, b]) => sum + (b - a), 0);
  const quietTotal = script.duration - slowTotal;
  const realLeft = Math.max(30, TARGET_REAL_SECONDS - slowTotal / SLOW_RATE);
  const fastRate = clamp(quietTotal / realLeft, MIN_FAST_RATE, MAX_FAST_RATE);
  let cursorT = 0;
  for (const [a, b] of slow) {
    if (a > cursorT) script.segments.push({ from: cursorT, to: a, rate: fastRate });
    script.segments.push({ from: a, to: b, rate: SLOW_RATE });
    cursorT = b;
  }
  if (cursorT < script.duration) script.segments.push({ from: cursorT, to: script.duration, rate: fastRate });

  // Real-time feel for ball movement: a pass is in the air for about this long on screen.
  const slowPass = 0.55 * SLOW_RATE; // ≈ half a second at 1×
  const fastPass = 0.45 * fastRate;

  // 3. Ball and players.
  const score = { home: 0, away: 0 };
  let kickoffSide: Side = rng.next() < 0.5 ? "home" : "away";

  periods.forEach((period, pi) => {
    point(period.start, PITCH_LENGTH / 2, PITCH_WIDTH / 2, 0.1);
    pass(period.start + 2, kickoffSide, randomOf(rng, outfield(kickoffSide)), slowPass);
    script.possession.push({ from: period.start, to: period.start + KICKOFF_WINDOW, side: kickoffSide, push: 0.2, ramp: RAMP_SECONDS });
    kickoffSide = other(kickoffSide);
    let free = period.start + KICKOFF_WINDOW;

    for (const plan of plansByPeriod[pi]) {
      const { shot, t, from: buildStart, to: end, stretch } = plan;
      // Players drift back after a run over the rest of this slow window plus about
      // a second on screen of whatever comes next, so nobody snaps back into place.
      const runsBefore = script.runs.length;
      earliest = stretch; // runs happen in slow motion: in this attack, or the one just before
      const side = shot.side;
      const defending = other(side);
      const keeper = keeperIndex(defending);
      const shooter = indexOf(side, shot.shooterId);
      filler(free, buildStart);

      // --- The build-up ---------------------------------------------------
      script.possession.push({ from: buildStart, to: t + 1.5, side, push: 1, ramp: RAMP_SECONDS });
      const room = t - buildStart;
      const gx = goalX(side);
      const holder = lastHolder();
      if (room > 9) {
        // Keep the ball, or win it (a tackle or an interception). Timed so the whole
        // movement happens inside the slow part, not half of it fast-forwarded.
        const startAt = buildStart + 0.6 * SLOW_RATE + 0.3;
        if (holder && holder.side === side) pass(startAt, side, holder.index, slowPass, true);
        else winBall(startAt, side, SLOW_RATE);
      }

      let shotTravel = 0.35 * SLOW_RATE; // a shot is quick
      if (shot.source === "penalty") {
        // The ball on the spot, the taker's run-up, the kick.
        const spotX = towardGoal(side, 11);
        point(t - 3, spotX, PITCH_WIDTH / 2, slowPass);
        addRun({ back: 0, side, index: shooter, from: buildStart, arrive: t - 2, until: t + 1, x: towardGoal(side, 12.5), y: PITCH_WIDTH / 2 });
      } else if (shot.source === "free kick") {
        const fkX = towardGoal(side, 21 + rng.next() * 6);
        const fkY = PITCH_WIDTH / 2 + (rng.next() * 2 - 1) * 10;
        point(t - 3, fkX, fkY, slowPass);
        addRun({ back: 0, side, index: shooter, from: buildStart, arrive: t - 2, until: t + 1, x: fkX - ATTACK_DIRECTION[side] * 1.5, y: fkY });
        shotTravel = 0.45 * SLOW_RATE; // curled over the wall
      } else if (shot.source === "corner") {
        // A corner: the attack is cleared over the goal line, the corner taker goes
        // to the flag and the ball is placed there, then a cross and a header.
        const flagX = gx === 0 ? 0.6 : PITCH_LENGTH - 0.6;
        const top = rng.next() < 0.5;
        const flagY = top ? 0.6 : PITCH_WIDTH - 0.6;
        const cornerEvent = result.events.find(
          (e) => e.type === "corner" && e.side === side && e.minute === shot.minute && e.addedTime === shot.addedTime,
        );
        const taker = cornerEvent?.type === "corner" ? indexOf(side, cornerEvent.takerId) : randomOf(rng, outfield(side));
        const byDepth = (team: Side) =>
          outfield(team).sort((a, b) => teams[team].players[a].attackWeight - teams[team].players[b].attackWeight);
        if (room > 11) {
          // How the corner is won: a forward shoots or crosses from the edge of the
          // box, a defender blocks it, and it deflects behind off him. A corner is
          // only ever given when the defending side touched the ball last.
          const forwards = byDepth(side).slice(-3).filter((i) => i !== taker && i !== shooter);
          const attacker = forwards.length > 0 ? randomOf(rng, forwards) : randomOf(rng, outfield(side).filter((i) => i !== taker));
          const shotSpot = { x: towardGoal(side, 16 + rng.next() * 8), y: PITCH_WIDTH / 2 + (top ? -1 : 1) * (5 + rng.next() * 10) };
          addRun({ back: 0, side, index: attacker, from: buildStart, arrive: t - 9.5, until: t - 7.5, x: shotSpot.x, y: shotSpot.y });
          pass(t - 9.5, side, attacker, slowPass, true);
          // The block: the nearest defender steps across, between the ball and goal.
          const blockSpot = {
            x: shotSpot.x + (gx - shotSpot.x) * 0.3,
            y: shotSpot.y + (PITCH_WIDTH / 2 - shotSpot.y) * 0.3,
          };
          let blocker = outfield(defending)[0];
          let bestDistance = Infinity;
          for (const i of outfield(defending)) {
            const pos = playerPosition(script, playerAt(defending, i), t - 10);
            const d = Math.hypot(pos.x - blockSpot.x, pos.y - blockSpot.y);
            if (d < bestDistance) {
              bestDistance = d;
              blocker = i;
            }
          }
          addRun({ back: 0, side: defending, index: blocker, from: buildStart, arrive: t - 8.3, until: t - 7.2, x: blockSpot.x, y: blockSpot.y });
          pass(t - 8.2, defending, blocker, 0.3 * SLOW_RATE); // the shot hits him…
          const outX = gx + (gx === 0 ? -2 : 2);
          const outY = PITCH_WIDTH / 2 + (top ? -1 : 1) * (8 + rng.next() * 18);
          point(t - 7, outX, outY, 0.35 * SLOW_RATE); // …and deflects behind
          script.feed.push({
            t: t - 7,
            clock: clockAt(script, t - 7),
            kind: "corner",
            side,
            shot,
            score: { ...score },
            attackerId: teams[side].players[attacker].player.id,
            blockerId: teams[defending].players[blocker].player.id,
          });
        }
        addRun({ back: 0, side, index: taker, from: buildStart, arrive: t - 3.2, until: t - 0.6, x: flagX, y: flagY });
        // The ball is placed on the corner flag; the taker swings it in from there.
        point(t - 3, flagX, flagY, 0.4 * SLOW_RATE);
        addRun({
          back: 0,
          side,
          index: shooter,
          from: buildStart,
          arrive: t - 1.2,
          until: t + 1,
          x: towardGoal(side, 6 + rng.next() * 4),
          y: PITCH_WIDTH / 2 + (rng.next() * 2 - 1) * 5,
        });
        // Pack the box: the big men go up (centre-backs and the striker), and the
        // defenders come back to mark them.
        const deepest = byDepth(side);
        const attackers = [deepest[0], deepest[1], deepest[deepest.length - 1]].filter((i) => i !== shooter && i !== taker);
        const markers = byDepth(defending).slice(0, 4);
        attackers.forEach((index, k) => {
          const spot = { x: towardGoal(side, 7 + rng.next() * 6), y: PITCH_WIDTH / 2 + (k - 1) * 6 + (rng.next() * 2 - 1) * 2 };
          addRun({ back: 0, side, index, from: buildStart, arrive: t - 1.5, until: t + 1, x: spot.x, y: spot.y });
          const marker = markers[k];
          if (marker !== undefined) {
            addRun({ back: 0, side: defending, index: marker, from: buildStart, arrive: t - 1.5, until: t + 1, x: towardGoal(side, 5.5 + rng.next() * 3), y: spot.y + 1 });
          }
        });
        const lastMarker = markers[attackers.length];
        if (lastMarker !== undefined) {
          addRun({ back: 0, side: defending, index: lastMarker, from: buildStart, arrive: t - 1.5, until: t + 1, x: towardGoal(side, 6), y: PITCH_WIDTH / 2 });
        }
        pass(t - 0.9, side, shooter, 0.6 * SLOW_RATE); // the cross hangs in the air
        shotTravel = 0.25 * SLOW_RATE;
      } else {
        // Open play: the shooter makes a run into the box; the assister goes wide.
        addRun({
          back: 0,
          side,
          index: shooter,
          from: buildStart,
          arrive: t - 1.4,
          until: t + 1,
          x: towardGoal(side, 9 + rng.next() * 12),
          y: PITCH_WIDTH / 2 + (rng.next() * 2 - 1) * 12,
        });
        if (shot.assistId) {
          const assister = indexOf(side, shot.assistId);
          if (room > 6) {
            const wide = rng.next() < 0.5 ? 1 : -1;
            addRun({
              back: 0,
              side,
              index: assister,
              from: buildStart,
              arrive: t - 4,
              until: t - 1,
              x: towardGoal(side, 18 + rng.next() * 10),
              y: PITCH_WIDTH / 2 + wide * (14 + rng.next() * 10),
            });
            pass(t - 4, side, assister, slowPass, true);
          }
        } else if (room > 6) {
          pass(t - 5, side, randomOf(rng, outfield(side).filter((i) => i !== shooter)), slowPass, true);
        }
        pass(t - 1.2, side, shooter, slowPass);
      }

      // --- The shot and what follows ---------------------------------------
      const aimY = PITCH_WIDTH / 2 + (rng.next() * 2 - 1) * (GOAL_HALF_WIDTH - 0.6);
      const lineX = gx + (gx === 0 ? 1.2 : -1.2); // just in front of the goal line
      if (shot.outcome === "goal") {
        score[side]++;
        point(t, gx + (gx === 0 ? -1.2 : 1.2), aimY, shotTravel);
        // The keeper dives — the wrong way, or too late.
        const dive = aimY + (rng.next() < 0.5 ? -1 : 1) * (2.5 + rng.next() * 2);
        addRun({ back: 0, side: defending, index: keeper, from: t - 0.6, arrive: t + 0.3, until: t + 2, x: lineX, y: dive });
        // Celebrations, then the ball back on the centre spot and a kick-off.
        if (end - t > 5) point(end - 2, PITCH_LENGTH / 2, PITCH_WIDTH / 2, slowPass);
        pass(end, defending, randomOf(rng, outfield(defending)), slowPass, true);
        script.possession.push({ from: t + 1.5, to: end, side: defending, push: 0, ramp: RAMP_SECONDS });
      } else if (shot.outcome === "saved") {
        // The keeper dives to the ball and holds it, then plays it out.
        addRun({ back: 0, side: defending, index: keeper, from: t - 0.6, arrive: t, until: t + 2, x: lineX, y: aimY });
        point(t, lineX, aimY, shotTravel);
        pass(t + 2, defending, keeper, 0.2 * SLOW_RATE);
        pass(end, defending, randomOf(rng, outfield(defending)), slowPass, true);
      } else if (shot.outcome === "post") {
        const postY = PITCH_WIDTH / 2 + (rng.next() < 0.5 ? -1 : 1) * GOAL_HALF_WIDTH;
        addRun({ back: 0, side: defending, index: keeper, from: t - 0.6, arrive: t + 0.2, until: t + 1.5, x: lineX, y: postY * 0.7 + aimY * 0.3 });
        point(t, gx, postY, shotTravel);
        point(t + 1.2, towardGoal(side, 8), postY + (rng.next() * 2 - 1) * 6, 0.3 * SLOW_RATE); // the rebound
        pass(end, defending, nearestOpponent(defending, t + 1.2), slowPass, true);
      } else {
        const wideY = PITCH_WIDTH / 2 + (rng.next() < 0.5 ? -1 : 1) * (GOAL_HALF_WIDTH + 2 + rng.next() * 6);
        addRun({ back: 0, side: defending, index: keeper, from: t - 0.6, arrive: t, until: t + 1, x: lineX, y: PITCH_WIDTH / 2 + (wideY - PITCH_WIDTH / 2) * 0.4 });
        point(t, gx + (gx === 0 ? -2.5 : 2.5), wideY, shotTravel);
        // Goal kick: the ball placed in the six-yard box, then played out.
        point(Math.min(end - 1, t + 3), towardGoal(side, 5.5), PITCH_WIDTH / 2 + (rng.next() * 2 - 1) * 6, 0.3 * SLOW_RATE);
        pass(end, defending, randomOf(rng, outfield(defending)), slowPass, true);
      }
      for (const run of script.runs.slice(runsBefore)) {
        if (run.back === 0) run.back = Math.max(1, end - run.until) + RUN_BACK_REAL * fastRate;
      }
      free = end;

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
    }
    filler(free, period.end);
  });

  script.possession.sort((a, b) => a.from - b.from);
  // Runs blend in order of when they arrive, so a player's latest intention wins.
  script.runs.sort((a, b) => a.arrive - b.arrive);
  return script;

  // Ordinary play between attacks (played fast): one side keeps the ball for a
  // while, then the other side intercepts it. Passes are spaced for the fast
  // speed so each one is still visible.
  function filler(from: number, to: number) {
    let t = from;
    let side: Side = lastHolder()?.side ?? (rng.next() < 0.5 ? "home" : "away");
    while (t < to - fastPass) {
      const spanEnd = Math.min(to, t + fastRate * (3 + rng.next() * 4)); // a few real seconds of possession
      // Ease over ~0.8 real seconds, however fast this spell plays.
      script.possession.push({ from: t, to: spanEnd, side, push: 0.25 + rng.next() * 0.4, ramp: Math.min(fastRate * 0.8, spanEnd - t) });
      let p = t + fastPass;
      // A new spell starts with this side winning the ball: a tackle or an interception.
      if (lastHolder()?.side !== side) {
        winBall(p, side, fastRate);
        p += fastRate * (1 + rng.next() * 0.6);
      }
      for (; p < spanEnd - fastPass * 0.5; p += fastRate * (1 + rng.next() * 0.6)) {
        const holder = lastHolder();
        const options = outfield(side).filter((i) => !(holder && holder.side === side && holder.index === i));
        pass(p, side, randomOf(rng, options), fastPass, true);
      }
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

// Ease in and out (0 → 1).
function smooth(k: number): number {
  const c = clamp(k, 0, 1);
  return c * c * (3 - 2 * c);
}
