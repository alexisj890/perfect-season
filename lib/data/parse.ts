// Turns raw CSV text into typed objects. Pure functions (no file access), so
// they work anywhere — load.ts does the file reading.
// Every parser throws on unexpected input so bad data fails loudly, not silently.

import Papa from "papaparse";
import type {
  ChemistryPoints,
  FitTier,
  Formation,
  IconicPair,
  NotableOmission,
  Player,
  Position,
  Rivalry,
  YearSpan,
} from "./types";

type Row = Record<string, string>;

function rows(csv: string): Row[] {
  const result = Papa.parse<Row>(csv.trim(), {
    header: true,
    skipEmptyLines: true,
    transform: (value) => value.trim(),
  });
  if (result.errors.length > 0) {
    throw new Error(`CSV parse error: ${result.errors[0].message}`);
  }
  return result.data;
}

function num(value: string, field: string): number {
  const n = Number(value);
  if (value === "" || Number.isNaN(n)) {
    throw new Error(`Expected a number for ${field}, got "${value}"`);
  }
  return n;
}

export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents: "Fàbregas" → "Fabregas"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// "2004–2012; 2014–present" → [{2004, 2012}, {2014, presentYear}]
// A lone year ("2010") is a one-season stint.
export function parseYearSpans(text: string, presentYear: number): YearSpan[] {
  return text.split(";").map((part) => {
    const [startText, endText = startText] = part.trim().split("–");
    const start = num(startText, `year span "${text}"`);
    const end = endText === "present" ? presentYear : num(endText, `year span "${text}"`);
    if (end < start) throw new Error(`Year span runs backwards: "${text}"`);
    return { start, end };
  });
}

// "DM/CM" → ["DM", "CM"]; "RW, ST" → ["RW", "ST"]; "" → []
function positionList(text: string, separator: string): Position[] {
  return text
    .split(separator)
    .map((p) => p.trim())
    .filter((p) => p !== "");
}

export function parsePlayers(csv: string): Player[] {
  return rows(csv).map((r) => {
    const endYear = num(r.end_year, "end_year");
    return {
      id: slugify(r.player),
      name: r.player,
      club: r.club,
      homeSlot: r.slot,
      poolOnly: r.pool_only === "yes",
      naturalPositions: positionList(r.natural_position, "/"),
      secondaryPositions: positionList(r.secondary_positions, ","),
      nationality: r.nationality,
      stints: parseYearSpans(r.years_at_club, endYear),
      peak: parseYearSpans(r.peak_window, endYear)[0],
      weightedScore: num(r.weighted_score, "weighted_score"),
      tier: r.tier,
      clubHighlights: r.club_highlights,
      selectionNote: r.selection_note,
    };
  });
}

export function parseFormation(slotsCsv: string, linksCsv: string): Formation {
  return {
    slots: rows(slotsCsv).map((r) => ({
      id: r.slot,
      accepts: r.accepts,
      pitchX: num(r.pitch_x, "pitch_x"),
      pitchY: num(r.pitch_y, "pitch_y"),
    })),
    links: rows(linksCsv).map((r) => [r.slot_a, r.slot_b]),
  };
}

export function parseFitTiers(csv: string): FitTier[] {
  return rows(csv).map((r) => ({ fit: r.fit, multiplier: num(r.multiplier, "multiplier") }));
}

export function parseSimilarPositions(csv: string): [Position, Position][] {
  return rows(csv).map((r) => [r.position_a, r.position_b]);
}

// The rule names in chemistry_rules.csv are long labels; map each to a short key.
// If a label is renamed in the CSV, this throws rather than quietly scoring 0.
const CHEMISTRY_LABELS: Record<keyof ChemistryPoints, string> = {
  clubmates: "Clubmates (same club, overlapping years)",
  internationalTeammates: "International teammates",
  iconicBonus: "Iconic partnership (bonus)",
  sameClubDifferentEra: "Same club, different era",
  sameNationalityDifferentEra: "Same nationality, different era",
  derbyRivals: "Derby rivals (penalty)",
  noLink: "No link",
};

export function parseChemistry(csv: string): ChemistryPoints {
  const byLabel = new Map(rows(csv).map((r) => [r.link_type, num(r.points, "points")]));
  const points = {} as ChemistryPoints;
  for (const [key, label] of Object.entries(CHEMISTRY_LABELS) as [keyof ChemistryPoints, string][]) {
    const value = byLabel.get(label);
    if (value === undefined) throw new Error(`chemistry_rules.csv is missing "${label}"`);
    points[key] = value;
  }
  return points;
}

// Pairs are matched to players by name + club, so a typo in either fails loudly.
export function parseIconicPairs(csv: string, players: Player[]): IconicPair[] {
  const idOf = (name: string, club: string) => {
    const player = players.find((p) => p.name === name && p.club === club);
    if (!player) throw new Error(`Iconic pair names unknown player: ${name} (${club})`);
    return player.id;
  };
  return rows(csv).map((r) => ({
    playerA: idOf(r.player_a, r.club_a),
    playerB: idOf(r.player_b, r.club_b),
    linkType: r.link_type,
    yearsTogether: r.years_together,
    context: r.context,
    bonusPoints: num(r.bonus_points, "bonus_points"),
  }));
}

export function parseRivalries(csv: string): Rivalry[] {
  return rows(csv).map((r) => ({
    clubA: r.club_a,
    clubB: r.club_b,
    name: r.rivalry,
    penalty: num(r.penalty, "penalty"),
  }));
}

export function parseNotableOmissions(csv: string): NotableOmission[] {
  return rows(csv).map((r) => ({
    player: r.player,
    clubsConsidered: r.clubs_considered,
    position: r.position,
    assignedPeakClub: r.assigned_peak_club,
    reason: r.reason,
  }));
}
