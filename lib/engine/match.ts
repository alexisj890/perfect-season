// The match engine. Pure: no React, no file access. Given two teams and a
// seeded Rng it returns the full result, including a timeline of events
// (shots, corners, goals, stoppage time) the UI can replay as an animation.
//
// The number of goals is drawn first (Poisson, from expected goals), so the
// difficulty calibration only depends on expectedGoals(). Everything else —
// misses, corners, who scored and how — is detail generated around those goals.

import { poisson, randomInt, weightedPick, type Rng } from "@/lib/rng";
import { ENGINE } from "./config";
import type { TeamPlayer, TeamProfile } from "./team";

export type Side = "home" | "away";
export type ChanceSource = keyof typeof ENGINE.chanceSources; // "open play" | "corner" | "free kick" | "penalty"
export type ShotOutcome = "goal" | "saved" | "post" | "wide";

// A moment in the match. Stoppage time is kept separate: 90+3' is
// { minute: 90, addedTime: 3 }. Extra time runs from 91 to 120.
export interface MatchClock {
  minute: number;
  addedTime: number;
}

export interface ShotEvent extends MatchClock {
  type: "shot";
  side: Side;
  source: ChanceSource;
  shooterId: string;
  assistId: string | null; // goals only
  outcome: ShotOutcome;
}

export interface CornerEvent extends MatchClock {
  type: "corner";
  side: Side;
  takerId: string;
}

export type MatchEvent = ShotEvent | CornerEvent;

export interface PenaltyKick {
  side: Side;
  takerId: string;
  outcome: ShotOutcome;
}

export interface StoppageTime {
  firstHalf: number;
  secondHalf: number;
  extraTimeFirstHalf: number | null; // null when there was no extra time
  extraTimeSecondHalf: number | null;
}

export interface MatchResult {
  homeGoals: number; // this match only, including extra time but not the shootout
  awayGoals: number;
  events: MatchEvent[]; // in time order; a corner comes just before the shot it leads to
  stoppageTime: StoppageTime;
  extraTime: boolean;
  shootout: { home: number; away: number; kicks: PenaltyKick[] } | null;
  aggregate: { home: number; away: number } | null; // second legs only, both legs combined
  // League and first legs: the match winner, or null for a draw.
  // Second legs: the winner of the tie. Finals: always set.
  winner: Side | null;
}

// The kind of match decides the rules:
//   league    — 90 minutes, draws allowed
//   firstLeg  — 90 minutes, draws allowed; the tie is settled in the second leg
//   secondLeg — if the aggregate is level after 90: extra time, then penalties
//   final     — neutral venue; if level after 90: extra time, then penalties
export type MatchType =
  | { kind: "league" }
  | { kind: "firstLeg" }
  // `firstLeg` holds the goals each side of THIS match scored in the first leg.
  | { kind: "secondLeg"; firstLeg: { home: number; away: number } }
  | { kind: "final" };

// Goals `attacker` is expected to score against `defender` over 90 minutes.
export function expectedGoals(attacker: TeamProfile, defender: TeamProfile, venueBoost: number): number {
  return (
    ENGINE.baseGoals *
    Math.exp(ENGINE.ratingSensitivity * softCap(attacker.attack - defender.defence)) *
    (attacker.chemistryFactor / defender.chemistryFactor) *
    venueBoost
  );
}

// Rating gaps count fully when small, but level off beyond the caps, so a
// huge mismatch is a comfortable win rather than a 12–0.
function softCap(gap: number): number {
  const cap = gap >= 0 ? ENGINE.ratingGapCapUp : ENGINE.ratingGapCapDown;
  return cap * Math.tanh(gap / cap);
}

export function simulateMatch(
  home: TeamProfile,
  away: TeamProfile,
  rng: Rng,
  type: MatchType = { kind: "league" },
): MatchResult {
  const homeBoost = type.kind === "final" ? 1 : ENGINE.homeAdvantage;
  const homeXg = expectedGoals(home, away, homeBoost);
  const awayXg = expectedGoals(away, home, 1);

  const stoppage = ENGINE.stoppageTime;
  const stoppageTime: StoppageTime = {
    firstHalf: randomInt(rng, ...stoppage.firstHalf),
    secondHalf: randomInt(rng, ...stoppage.secondHalf),
    extraTimeFirstHalf: null,
    extraTimeSecondHalf: null,
  };
  const regulation: Half[] = [
    { start: 1, end: 45, added: stoppageTime.firstHalf },
    { start: 46, end: 90, added: stoppageTime.secondHalf },
  ];
  const events = [
    ...playPhase(home, "home", homeXg, regulation, rng),
    ...playPhase(away, "away", awayXg, regulation, rng),
  ];

  // Goals brought from the first leg (zero unless this is a second leg).
  const carried = type.kind === "secondLeg" ? type.firstLeg : { home: 0, away: 0 };
  const total = (side: Side) => countGoals(events, side) + carried[side];
  const mustHaveWinner = type.kind === "secondLeg" || type.kind === "final";

  let extraTime = false;
  if (mustHaveWinner && total("home") === total("away")) {
    extraTime = true;
    stoppageTime.extraTimeFirstHalf = randomInt(rng, ...stoppage.extraTimeHalf);
    stoppageTime.extraTimeSecondHalf = randomInt(rng, ...stoppage.extraTimeHalf);
    const halves: Half[] = [
      { start: 91, end: 105, added: stoppageTime.extraTimeFirstHalf },
      { start: 106, end: 120, added: stoppageTime.extraTimeSecondHalf },
    ];
    // Extra time is 30 minutes, so each side expects a third of its 90-minute goals.
    const share = ENGINE.extraTimeMinutes / 90;
    events.push(
      ...playPhase(home, "home", homeXg * share, halves, rng),
      ...playPhase(away, "away", awayXg * share, halves, rng),
    );
  }
  // A stable sort keeps each corner just ahead of the shot it led to.
  events.sort((a, b) => clockOrder(a) - clockOrder(b));

  const shootout =
    mustHaveWinner && total("home") === total("away") ? penaltyShootout(home, away, rng) : null;

  let winner: Side | null =
    total("home") > total("away") ? "home" : total("away") > total("home") ? "away" : null;
  if (shootout) winner = shootout.home > shootout.away ? "home" : "away";

  return {
    homeGoals: countGoals(events, "home"),
    awayGoals: countGoals(events, "away"),
    events,
    stoppageTime,
    extraTime,
    shootout,
    aggregate: type.kind === "secondLeg" ? { home: total("home"), away: total("away") } : null,
    winner,
  };
}

// ---------------------------------------------------------------------------
// Helpers for reading a result (used by tests, scripts and the UI)

export function goalsOf(result: MatchResult): ShotEvent[] {
  return result.events.filter((e): e is ShotEvent => e.type === "shot" && e.outcome === "goal");
}

// The same result with only its goals kept (no shots or corners). Used to keep
// saved games small for matches the user won't replay.
export function keepGoalsOnly(result: MatchResult): MatchResult {
  return { ...result, events: goalsOf(result) };
}

export interface SideStats {
  goals: number;
  shots: number;
  shotsOnTarget: number; // goals + saves
  corners: number;
  woodwork: number;
}

export function matchStats(result: MatchResult): Record<Side, SideStats> {
  const statsFor = (side: Side): SideStats => {
    const shots = result.events.filter((e): e is ShotEvent => e.type === "shot" && e.side === side);
    return {
      goals: shots.filter((s) => s.outcome === "goal").length,
      shots: shots.length,
      shotsOnTarget: shots.filter((s) => s.outcome === "goal" || s.outcome === "saved").length,
      corners: result.events.filter((e) => e.type === "corner" && e.side === side).length,
      woodwork: shots.filter((s) => s.outcome === "post").length,
    };
  };
  return { home: statsFor("home"), away: statsFor("away") };
}

// 90+3' style label.
export function formatClock(clock: MatchClock): string {
  return clock.addedTime > 0 ? `${clock.minute}+${clock.addedTime}'` : `${clock.minute}'`;
}

// ---------------------------------------------------------------------------
// Taker choices

// A player's attacking strength: their rating, weighted by how far up the
// pitch their slot is. A 90-rated striker outranks a 95-rated centre-back.
export function attackingStrength(p: TeamPlayer): number {
  return p.rating * p.attackWeight;
}

// Shootout order: attacking strength, best first; the keeper goes last.
export function takerOrder(team: TeamProfile): TeamPlayer[] {
  const outfield = team.players
    .filter((p) => !p.isKeeperSlot)
    .sort((a, b) => attackingStrength(b) - attackingStrength(a));
  return [...outfield, ...team.players.filter((p) => p.isKeeperSlot)];
}

// Takes in-match penalties and direct free kicks: the most attacking player.
export function setPieceTaker(team: TeamProfile): TeamPlayer {
  return takerOrder(team)[0];
}

// Takes corners: the best-rated midfielder or winger (see ENGINE.cornerTakerBand).
export function cornerTaker(team: TeamProfile): TeamPlayer {
  const { min, max } = ENGINE.cornerTakerBand;
  const outfield = team.players.filter((p) => !p.isKeeperSlot);
  const inBand = outfield.filter((p) => p.attackWeight >= min && p.attackWeight <= max);
  const pool = inBand.length > 0 ? inBand : outfield;
  return pool.reduce((best, p) => (p.rating > best.rating ? p : best));
}

// ---------------------------------------------------------------------------
// Generating events

interface Half {
  start: number; // first minute, e.g. 46
  end: number; // last regular minute, e.g. 90
  added: number; // stoppage minutes after `end`
}

function clockOrder(c: MatchClock): number {
  return c.minute + c.addedTime / 100; // 45+3 sorts before 46
}

// A uniformly random moment across the halves, stoppage time included.
function randomClock(rng: Rng, halves: Half[]): MatchClock {
  const length = halves.reduce((sum, h) => sum + (h.end - h.start + 1) + h.added, 0);
  let roll = randomInt(rng, 0, length - 1);
  for (const h of halves) {
    const regular = h.end - h.start + 1;
    if (roll < regular) return { minute: h.start + roll, addedTime: 0 };
    roll -= regular;
    if (roll < h.added) return { minute: h.end, addedTime: roll + 1 };
    roll -= h.added;
  }
  throw new Error("randomClock fell off the end of the match");
}

function countGoals(events: MatchEvent[], side: Side): number {
  return events.filter((e) => e.type === "shot" && e.side === side && e.outcome === "goal").length;
}

// Every event for one side over one phase (90 minutes, or extra time).
function playPhase(team: TeamProfile, side: Side, expected: number, halves: Half[], rng: Rng): MatchEvent[] {
  const corner = cornerTaker(team);
  const events: MatchEvent[] = [];

  for (const source of Object.keys(ENGINE.chanceSources) as ChanceSource[]) {
    const { goalShare, conversion } = ENGINE.chanceSources[source];
    // Splitting a Poisson count by fixed shares keeps total goals Poisson(expected).
    const goals = poisson(rng, expected * goalShare);
    const misses = poisson(rng, (expected * goalShare * (1 - conversion)) / conversion);
    for (let i = 0; i < goals + misses; i++) {
      const clock = randomClock(rng, halves);
      const outcome: ShotOutcome = i < goals ? "goal" : missOutcome(rng, source);
      const shooter = pickShooter(rng, team, source, corner);
      if (source === "corner") events.push({ type: "corner", ...clock, side, takerId: corner.player.id });
      events.push({
        type: "shot",
        ...clock,
        side,
        source,
        shooterId: shooter.player.id,
        assistId: outcome === "goal" ? pickAssist(rng, team, source, shooter, corner) : null,
        outcome,
      });
    }
  }

  // Corners that come to nothing.
  const quietCorners = poisson(rng, expected * ENGINE.extraCornersPerExpectedGoal);
  for (let i = 0; i < quietCorners; i++) {
    events.push({ type: "corner", ...randomClock(rng, halves), side, takerId: corner.player.id });
  }
  return events;
}

function pickShooter(rng: Rng, team: TeamProfile, source: ChanceSource, corner: TeamPlayer): TeamPlayer {
  if (source === "penalty" || source === "free kick") return setPieceTaker(team);
  if (source === "corner") {
    // Headers: players at either end of the pitch (centre-backs, strikers)
    // attack the ball most. Keepers stay home, and the taker can't head his own corner.
    const attackers = team.players.filter((p) => !p.isKeeperSlot && p !== corner);
    return weightedPick(rng, attackers, (p) => p.rating * ((Math.abs(p.attackWeight - 50) + 50) / 100) ** 2);
  }
  // Open play: forwards shoot far more than defenders; keepers almost never.
  return weightedPick(rng, team.players, (p) => p.rating * (p.attackWeight / 100) ** 2);
}

function pickAssist(
  rng: Rng,
  team: TeamProfile,
  source: ChanceSource,
  scorer: TeamPlayer,
  corner: TeamPlayer,
): string | null {
  if (source === "corner") return corner.player.id;
  if (source !== "open play" || rng.next() >= ENGINE.assistChance) return null;
  const others = team.players.filter((p) => p !== scorer);
  return weightedPick(rng, others, (p) => p.rating * (p.attackWeight / 100)).player.id;
}

function missOutcome(rng: Rng, source: ChanceSource): Exclude<ShotOutcome, "goal"> {
  const weights = source === "penalty" ? ENGINE.penaltyMissOutcomes : ENGINE.missOutcomes;
  return weightedPick(rng, ["saved", "post", "wide"] as const, (o) => weights[o]);
}

// ---------------------------------------------------------------------------
// Penalty shootout

function penaltyChance(taker: TeamPlayer, keeper: TeamPlayer): number {
  const chance = ENGINE.penaltyBaseChance + ENGINE.penaltySkillEffect * (taker.rating - keeper.rating);
  return Math.max(ENGINE.penaltyChanceMin, Math.min(ENGINE.penaltyChanceMax, chance));
}

function keeperOf(team: TeamProfile): TeamPlayer {
  return team.players.find((p) => p.isKeeperSlot) ?? team.players[0];
}

function penaltyShootout(home: TeamProfile, away: TeamProfile, rng: Rng) {
  const teams = { home, away };
  const order = { home: takerOrder(home), away: takerOrder(away) };
  const score = { home: 0, away: 0 };
  const taken = { home: 0, away: 0 };
  const kicks: PenaltyKick[] = [];
  const first: Side = rng.next() < 0.5 ? "home" : "away"; // coin toss
  const second: Side = first === "home" ? "away" : "home";

  const kick = (side: Side) => {
    const other = side === "home" ? "away" : "home";
    const taker = order[side][taken[side] % order[side].length];
    const scored = rng.next() < penaltyChance(taker, keeperOf(teams[other]));
    taken[side]++;
    if (scored) score[side]++;
    kicks.push({ side, takerId: taker.player.id, outcome: scored ? "goal" : missOutcome(rng, "penalty") });
  };
  // During the first five each, stop as soon as one side can't catch up.
  const decided = () =>
    score.home > score.away + (5 - taken.away) || score.away > score.home + (5 - taken.home);

  for (let round = 0; round < 5 && !decided(); round++) {
    kick(first);
    if (decided()) break;
    kick(second);
  }
  // Sudden death: one kick each until a round ends with a difference.
  while (score.home === score.away) {
    kick(first);
    kick(second);
  }
  return { home: score.home, away: score.away, kicks };
}
