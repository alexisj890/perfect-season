// How each difficulty is described on the landing page.
// `perfectOdds` comes from `npm run odds` (a strong draft's chance of going 35–0);
// update it if the engine or draft tuning changes.

import type { Difficulty } from "@/lib/draft/config";

export interface DifficultyInfo {
  id: Difficulty;
  label: string;
  rivals: string;
  perfectOdds: string;
}

export const DIFFICULTIES: DifficultyInfo[] = [
  {
    id: "easy",
    label: "Easy",
    rivals: "Rival managers chase big names and panic-buy. Room to build a juggernaut.",
    perfectOdds: "≈ 1 in 11",
  },
  {
    id: "normal",
    label: "Normal",
    rivals: "A couple of sharp managers among the chaos. A perfect season takes a great draft.",
    perfectOdds: "≈ 1 in 40",
  },
  {
    id: "hard",
    label: "Hard",
    rivals: "Most managers draft well. Even a brilliant XI rarely goes unbeaten.",
    perfectOdds: "≈ 1 in 300",
  },
];
