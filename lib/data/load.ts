// Reads data/*.csv from disk. Uses Node's file system, so call this only from
// server code (server components, scripts, tests) — never from a browser component.
// Pages load the data here and pass the plain result down to the UI.

import { readFileSync } from "node:fs";
import path from "node:path";
import {
  parseChemistry,
  parseFitTiers,
  parseFormation,
  parseIconicPairs,
  parseNotableOmissions,
  parsePlayers,
  parseRivalries,
  parseSimilarPositions,
} from "./parse";
import type { GameData } from "./types";

export function loadGameData(): GameData {
  // Always the project's data/ folder, written out in full so Next.js can tell
  // exactly which files the server needs when it bundles the app.
  const read = (file: string) => readFileSync(path.join(process.cwd(), "data", file), "utf8");
  const players = parsePlayers(read("players.csv"));
  return {
    players,
    formation: parseFormation(read("formation_slots.csv"), read("formation_links.csv")),
    fitTiers: parseFitTiers(read("position_fit.csv")),
    similarPositions: parseSimilarPositions(read("position_similarity.csv")),
    chemistry: parseChemistry(read("chemistry_rules.csv")),
    iconicPairs: parseIconicPairs(read("iconic_pairs.csv"), players),
    rivalries: parseRivalries(read("rivalries.csv")),
    notableOmissions: parseNotableOmissions(read("notable_omissions.csv")),
  };
}
