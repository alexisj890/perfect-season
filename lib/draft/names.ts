// Computer team names, chosen to hint at how each team drafts.

import { randomInt, type Rng } from "@/lib/rng";
import type { DraftStyle } from "./styles";

export const TEAM_NAMES: Record<DraftStyle, string[]> = {
  balanced: [
    "Harmony XI",
    "The Chemists",
    "United Front",
    "Kindred Athletic",
    "Common Cause FC",
    "Brotherhood Rovers",
    "Old Friends United",
    "Synergy Town",
    "Band of Brothers",
    "The Familiars",
  ],
  ignoresChemistry: [
    "Spreadsheet City",
    "Moneyball FC",
    "Ratings Rovers",
    "Numbers Athletic",
    "Algorithm United",
    "Data Driven Town",
    "Cold Logic FC",
    "Percentage Players",
    "Expected Goals XI",
    "The Calculators",
  ],
  starChaser: [
    "The Galácticos",
    "Star Collectors",
    "Big Name FC",
    "Headline Hunters",
    "Marquee United",
    "Shirt Sales Athletic",
    "Red Carpet Rovers",
    "Poster Boys FC",
    "Hollywood Town",
    "The Showboats",
  ],
  panicFill: [
    "Deadline Day FC",
    "Panic Buyers United",
    "Scramble Athletic",
    "Last-Minute Rovers",
    "Emergency Loan XI",
    "Fire Sale Town",
    "Window Shoppers FC",
    "The Stopgaps",
    "Hurry Up Harriers",
    "Plan B United",
  ],
};

// One name per computer team, never repeated within a league.
export function pickTeamNames(styles: DraftStyle[], rng: Rng): string[] {
  const used = new Set<string>();
  return styles.map((style, i) => {
    const left = TEAM_NAMES[style].filter((n) => !used.has(n));
    const name = left.length > 0 ? left[randomInt(rng, 0, left.length - 1)] : `${TEAM_NAMES[style][0]} ${i + 1}`;
    used.add(name);
    return name;
  });
}
