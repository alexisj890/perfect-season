// The match engine. Pure: no React, no file access. Given two teams and a
// seeded Rng it returns the full result, including a goal timeline the UI can
// replay as an animation.

import { poisson, randomInt, weightedPick, type Rng } from "@/lib/rng";
import { ENGINE } from "./config";
import type { TeamPlayer, TeamProfile } from "./team";

export type Side = "home" | "away";

export interface GoalEvent {
  minute: number; // 1–90, or 91–120 in extra time
  side: Side;
  scorerId: string;
  assistId: string | null;
}

export interface PenaltyKick {
  side: Side;
  takerId: string;
  scored: boolean;
}

export interface MatchResult {
  homeGoals: number; // this match only, including extra time but not the shootout
  awayGoals: number;
  goals: GoalEvent[]; // in minute order
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

// Rating gaps count fully when small, but level off beyond ENGINE.ratingGapCap,
// so a huge mismatch is a comfortable win rather than a 12–0.
function softCap(gap: number): number {
  return ENGINE.ratingGapCap * Math.tanh(gap / ENGINE.ratingGapCap);
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

  const goals = [
    ...playPeriod(home, "home", homeXg, 1, 90, rng),
    ...playPeriod(away, "away", awayXg, 1, 90, rng),
  ];

  // Goals brought from the first leg (zero unless this is a second leg).
  const carried = type.kind === "secondLeg" ? type.firstLeg : { home: 0, away: 0 };
  const total = (side: Side) => count(goals, side) + carried[side];
  const mustHaveWinner = type.kind === "secondLeg" || type.kind === "final";

  let extraTime = false;
  if (mustHaveWinner && total("home") === total("away")) {
    extraTime = true;
    // Extra time is 30 minutes, so each side expects a third of its 90-minute goals.
    const share = ENGINE.extraTimeMinutes / 90;
    goals.push(
      ...playPeriod(home, "home", homeXg * share, 91, 90 + ENGINE.extraTimeMinutes, rng),
      ...playPeriod(away, "away", awayXg * share, 91, 90 + ENGINE.extraTimeMinutes, rng),
    );
  }
  goals.sort((a, b) => a.minute - b.minute);

  const shootout =
    mustHaveWinner && total("home") === total("away") ? penaltyShootout(home, away, rng) : null;

  let winner: Side | null =
    total("home") > total("away") ? "home" : total("away") > total("home") ? "away" : null;
  if (shootout) winner = shootout.home > shootout.away ? "home" : "away";

  return {
    homeGoals: count(goals, "home"),
    awayGoals: count(goals, "away"),
    goals,
    extraTime,
    shootout,
    aggregate: type.kind === "secondLeg" ? { home: total("home"), away: total("away") } : null,
    winner,
  };
}

function count(goals: GoalEvent[], side: Side): number {
  return goals.filter((g) => g.side === side).length;
}

function playPeriod(
  team: TeamProfile,
  side: Side,
  expected: number,
  firstMinute: number,
  lastMinute: number,
  rng: Rng,
): GoalEvent[] {
  const events: GoalEvent[] = [];
  const n = poisson(rng, expected);
  for (let i = 0; i < n; i++) {
    // Forwards score far more often than defenders; keepers almost never.
    const scorer = weightedPick(rng, team.players, (p) => p.rating * (p.attackWeight / 100) ** 2);
    let assistId: string | null = null;
    if (rng.next() < ENGINE.assistChance) {
      const others = team.players.filter((p) => p !== scorer);
      assistId = weightedPick(rng, others, (p) => p.rating * (p.attackWeight / 100)).player.id;
    }
    events.push({
      minute: randomInt(rng, firstMinute, lastMinute),
      side,
      scorerId: scorer.player.id,
      assistId,
    });
  }
  return events;
}

function penaltyChance(taker: TeamPlayer, keeper: TeamPlayer): number {
  const chance = ENGINE.penaltyBaseChance + ENGINE.penaltySkillEffect * (taker.rating - keeper.rating);
  return Math.max(ENGINE.penaltyChanceMin, Math.min(ENGINE.penaltyChanceMax, chance));
}

// A player's attacking strength: their rating, weighted by how far up the
// pitch their slot is. A 90-rated striker outranks a 95-rated centre-back.
export function attackingStrength(p: TeamPlayer): number {
  return p.rating * p.attackWeight;
}

// Takers go in order of attacking strength, best first; the keeper goes last.
export function takerOrder(team: TeamProfile): TeamPlayer[] {
  const outfield = team.players
    .filter((p) => !p.isKeeperSlot)
    .sort((a, b) => attackingStrength(b) - attackingStrength(a));
  return [...outfield, ...team.players.filter((p) => p.isKeeperSlot)];
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
    kicks.push({ side, takerId: taker.player.id, scored });
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
