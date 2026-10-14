// Player match ratings (0–10, like SofaScore / FotMob), worked out from a
// match's events. Display only: ratings never affect results.
//
// Everyone starts from a base, nudged by how good the player is, then:
//   goal +1.0, assist +0.7, shot on target +0.15, hitting the woodwork +0.1,
//   missed penalty −0.6; keepers +0.2 per save; keepers and defenders +0.5 for
//   a clean sheet and −0.25 per goal conceded; everyone +0.3 for a win, −0.3
//   for a defeat; plus a small fixed wobble per player per match, so ratings
//   aren't identical. Clamped to 3.0–10.0. The best rating is Man of the Match.

import { goalsOf, type MatchResult, type ShotEvent, type Side } from "./match";
import type { TeamPlayer, TeamProfile } from "./team";

export const RATING = {
  base: 6.4,
  qualityEffect: 0.02, // per player rating point above/below 85
  goal: 1.0,
  assist: 0.7,
  shotOnTarget: 0.15,
  woodwork: 0.1,
  missedPenalty: -0.6,
  save: 0.2,
  cleanSheet: 0.5,
  goalConceded: -0.25,
  win: 0.3,
  loss: -0.3,
  wobble: 0.35, // ± this much, fixed per player per match
  min: 3,
  max: 10,
  defenderAttackWeight: 30, // slots this deep (100 − pitch_y below 30) count as defensive
};

export interface PlayerRating {
  playerId: string;
  slot: string;
  side: Side;
  rating: number; // one decimal place
  goals: number;
  assists: number;
  motm: boolean;
}

export interface MatchRatings {
  home: PlayerRating[]; // in formation order
  away: PlayerRating[];
  motm: string; // player id
}

// A stable pseudo-random number in [0, 1) from a string (FNV-1a hash), so a
// player's wobble in a given match is always the same.
export function stableRandom(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967296;
}

// `matchKey` identifies the match (e.g. "league-4-2-9"); it seeds the wobble.
export function matchRatings(result: MatchResult, home: TeamProfile, away: TeamProfile, matchKey: string): MatchRatings {
  const shots = result.events.filter((e): e is ShotEvent => e.type === "shot");
  const goalsFor = { home: result.homeGoals, away: result.awayGoals };
  const outcome = (side: Side) => {
    const other = side === "home" ? "away" : "home";
    return goalsFor[side] > goalsFor[other] ? "win" : goalsFor[side] < goalsFor[other] ? "loss" : "draw";
  };

  const rateTeam = (team: TeamProfile, side: Side): PlayerRating[] => {
    const other: Side = side === "home" ? "away" : "home";
    const conceded = goalsFor[other];
    const savesMade = shots.filter((s) => s.side === other && s.outcome === "saved").length;
    const result90 = outcome(side);

    return team.players.map((p: TeamPlayer) => {
      const id = p.player.id;
      const mine = shots.filter((s) => s.side === side && s.shooterId === id);
      const goals = goalsOf(result).filter((g) => g.side === side && g.shooterId === id).length;
      const assists = goalsOf(result).filter((g) => g.side === side && g.assistId === id).length;
      const onTarget = mine.filter((s) => s.outcome === "goal" || s.outcome === "saved").length;
      const woodwork = mine.filter((s) => s.outcome === "post").length;
      const missedPens = mine.filter((s) => s.source === "penalty" && s.outcome !== "goal").length;
      const defensive = p.isKeeperSlot || p.attackWeight < RATING.defenderAttackWeight;

      let rating = RATING.base + (p.rating - 85) * RATING.qualityEffect;
      rating += goals * RATING.goal + assists * RATING.assist;
      rating += onTarget * RATING.shotOnTarget + woodwork * RATING.woodwork + missedPens * RATING.missedPenalty;
      if (p.isKeeperSlot) rating += savesMade * RATING.save;
      if (defensive) rating += conceded === 0 ? RATING.cleanSheet : conceded * RATING.goalConceded;
      if (result90 === "win") rating += RATING.win;
      if (result90 === "loss") rating += RATING.loss;
      rating += (stableRandom(`${matchKey}|${id}`) * 2 - 1) * RATING.wobble;

      const clamped = Math.min(RATING.max, Math.max(RATING.min, rating));
      return { playerId: id, slot: p.slot, side, rating: Math.round(clamped * 10) / 10, goals, assists, motm: false };
    });
  };

  const homeRatings = rateTeam(home, "home");
  const awayRatings = rateTeam(away, "away");
  // Man of the Match: the best rating; ties go to the player with more goals, then assists.
  const best = [...homeRatings, ...awayRatings].sort(
    (a, b) => b.rating - a.rating || b.goals - a.goals || b.assists - a.assists,
  )[0];
  best.motm = true;
  return { home: homeRatings, away: awayRatings, motm: best.playerId };
}

export interface SeasonPlayerStats {
  playerId: string;
  slot: string;
  apps: number;
  averageRating: number; // one decimal place
  goals: number;
  assists: number;
  motm: number;
}

// A team's season so far, per player, from the ratings of each match it played.
export function seasonPlayerStats(team: TeamProfile, matches: { ratings: MatchRatings; side: Side }[]): SeasonPlayerStats[] {
  return team.players
    .map((p) => {
      const games = matches.map((m) => m.ratings[m.side].find((r) => r.playerId === p.player.id)!).filter(Boolean);
      const total = games.reduce((sum, r) => sum + r.rating, 0);
      return {
        playerId: p.player.id,
        slot: p.slot,
        apps: games.length,
        averageRating: games.length ? Math.round((total / games.length) * 10) / 10 : 0,
        goals: games.reduce((sum, r) => sum + r.goals, 0),
        assists: games.reduce((sum, r) => sum + r.assists, 0),
        motm: games.filter((r) => r.motm).length,
      };
    })
    .sort((a, b) => b.averageRating - a.averageRating);
}
