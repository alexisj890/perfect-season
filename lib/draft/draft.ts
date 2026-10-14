// The snake draft. Pure functions over a plain, JSON-serializable DraftState:
// every action returns a new state and never changes the old one, so a draft
// can be saved at any pick and resumed later.

import type { GameData, Player, SlotId } from "@/lib/data/types";
import type { Lineup } from "@/lib/engine/team";
import { createRng, randomInt, weightedPick } from "@/lib/rng";
import { DRAFT, type Difficulty } from "./config";
import { pickTeamNames } from "./names";
import type { DraftStyle } from "./styles";

export interface DraftTeam {
  name: string;
  isUser: boolean;
  style: DraftStyle | null; // computer teams only
}

export interface DraftPick {
  pickNumber: number; // 1-based, across the whole draft
  round: number; // 1-based
  teamIndex: number; // index into DraftState.teams (= draft position − 1)
  playerId: string;
  slot: SlotId;
}

export interface DraftState {
  difficulty: Difficulty;
  teams: DraftTeam[]; // in draft order: teams[0] picks first in round 1
  rounds: number; // one round per formation slot
  picks: DraftPick[];
  rngState: number; // where the random sequence continues from
}

export interface PickTurn {
  pickNumber: number;
  round: number;
  teamIndex: number;
}

// ---------------------------------------------------------------------------
// Setting up

export interface DraftOptions {
  difficulty?: Difficulty; // default "normal"
  teamCount?: number; // default 16
  userName?: string; // default "Your XI"
}

export function createDraft(data: GameData, seed: number, options: DraftOptions = {}): DraftState {
  const { difficulty = "normal", teamCount = DRAFT.teamCount, userName = "Your XI" } = options;
  const rounds = data.formation.slots.length;
  if (data.players.length < teamCount * rounds) {
    throw new Error(`Need ${teamCount * rounds} players for ${teamCount} teams, have ${data.players.length}`);
  }
  const rng = createRng(seed);
  const userIndex = randomInt(rng, 0, teamCount - 1); // the user's random draft position
  const styleWeights = DRAFT.difficulties[difficulty].styles;
  const allStyles = Object.keys(styleWeights) as DraftStyle[];
  const styles = Array.from({ length: teamCount }, () => weightedPick(rng, allStyles, (s) => styleWeights[s]));
  const names = pickTeamNames(styles, rng);
  const teams = Array.from({ length: teamCount }, (_, i): DraftTeam => {
    if (i === userIndex) return { name: userName, isUser: true, style: null };
    return { name: names[i], isUser: false, style: styles[i] };
  });
  return { difficulty, teams, rounds, picks: [], rngState: rng.state() };
}

// ---------------------------------------------------------------------------
// Reading the state

// Snake order: round 1 runs 0→15, round 2 runs 15→0, and so on.
export function turnAt(state: DraftState, pickNumber: number): PickTurn {
  const n = state.teams.length;
  const round = Math.floor((pickNumber - 1) / n) + 1;
  const positionInRound = (pickNumber - 1) % n;
  const teamIndex = round % 2 === 1 ? positionInRound : n - 1 - positionInRound;
  return { pickNumber, round, teamIndex };
}

// Every pick number a team gets, in order (e.g. 7, 26, 39, … for the 7th pick).
export function picksForTeam(state: DraftState, teamIndex: number): number[] {
  const picks: number[] = [];
  for (let n = 1; n <= totalPicks(state); n++) if (turnAt(state, n).teamIndex === teamIndex) picks.push(n);
  return picks;
}

export function totalPicks(state: DraftState): number {
  return state.teams.length * state.rounds;
}

export function isComplete(state: DraftState): boolean {
  return state.picks.length >= totalPicks(state);
}

// Whose turn it is, or null once the draft is over.
export function currentTurn(state: DraftState): PickTurn | null {
  return isComplete(state) ? null : turnAt(state, state.picks.length + 1);
}

export function userTeamIndex(state: DraftState): number {
  return state.teams.findIndex((t) => t.isUser);
}

export function availablePlayers(state: DraftState, data: GameData): Player[] {
  const taken = new Set(state.picks.map((p) => p.playerId));
  return data.players.filter((p) => !taken.has(p.id));
}

export function openSlots(state: DraftState, teamIndex: number, data: GameData): SlotId[] {
  const filled = new Set(state.picks.filter((p) => p.teamIndex === teamIndex).map((p) => p.slot));
  return data.formation.slots.map((s) => s.id).filter((id) => !filled.has(id));
}

export function lineupOf(state: DraftState, teamIndex: number): Lineup {
  return Object.fromEntries(
    state.picks.filter((p) => p.teamIndex === teamIndex).map((p) => [p.slot, p.playerId]),
  );
}

// ---------------------------------------------------------------------------
// Making picks

// Puts `playerId` into `slot` for the team on the clock. Throws if the pick
// isn't legal, so the UI can never put the draft into a broken state.
export function makePick(state: DraftState, data: GameData, playerId: string, slot: SlotId): DraftState {
  const turn = currentTurn(state);
  if (!turn) throw new Error("The draft is already complete");
  if (!availablePlayers(state, data).some((p) => p.id === playerId)) {
    throw new Error(`Player "${playerId}" is not available`);
  }
  if (!openSlots(state, turn.teamIndex, data).includes(slot)) {
    throw new Error(`Slot "${slot}" is not open for ${state.teams[turn.teamIndex].name}`);
  }
  return { ...state, picks: [...state.picks, { ...turn, playerId, slot }] };
}
