// Typed shapes for everything in data/*.csv.
// Slot ids and position codes are plain strings on purpose: formations live in
// the data, so the code never hard-codes which slots exist.

export type SlotId = string; // e.g. "RCB" — a place in the formation
export type Position = string; // e.g. "CB", "SS" — a role a player can play

export interface YearSpan {
  start: number;
  end: number; // "present" is stored as the CSV's end_year
}

export interface Player {
  id: string; // slug of the name, e.g. "xavi-hernandez"
  name: string;
  club: string;
  // The slot this player fills in their club's all-time XI — or, for a
  // pool-only player, the slot they'd naturally fill.
  homeSlot: SlotId;
  // An extra draftable player who isn't in their club's all-time XI (from
  // notable_omissions.csv). Left out of club XIs and the engine's average XI.
  poolOnly: boolean;
  naturalPositions: Position[];
  secondaryPositions: Position[];
  nationality: string;
  stints: YearSpan[]; // years at club, split on gaps ("2001–2006; 2010")
  peak: YearSpan;
  weightedScore: number; // rating before any position-fit penalty
  tier: string;
  clubHighlights: string;
  selectionNote: string;
}

export interface FormationSlot {
  id: SlotId;
  accepts: Position; // the slot family, e.g. RCB and LCB both accept "CB"
  pitchX: number; // 0–100, left to right
  pitchY: number; // 0–100, attacking end (0) to own goal (100)
}

export interface Formation {
  slots: FormationSlot[];
  links: [SlotId, SlotId][]; // neighbouring slots on the pitch
}

export interface FitTier {
  fit: string; // "Natural", "Secondary", "Similar", "Out of position", "Goalkeeper swap"
  multiplier: number;
}

export interface ChemistryPoints {
  clubmates: number;
  internationalTeammates: number;
  iconicBonus: number;
  sameClubDifferentEra: number;
  sameNationalityDifferentEra: number;
  derbyRivals: number;
  noLink: number;
}

export interface IconicPair {
  playerA: string; // player id
  playerB: string; // player id
  linkType: string;
  yearsTogether: string;
  context: string;
  bonusPoints: number;
}

export interface Rivalry {
  clubA: string;
  clubB: string;
  name: string;
  penalty: number;
}

export interface NotableOmission {
  player: string;
  clubsConsidered: string;
  position: string;
  assignedPeakClub: string;
  reason: string;
}

export interface GameData {
  players: Player[];
  formation: Formation;
  fitTiers: FitTier[];
  similarPositions: [Position, Position][];
  chemistry: ChemistryPoints;
  iconicPairs: IconicPair[];
  rivalries: Rivalry[];
  notableOmissions: NotableOmission[];
}
