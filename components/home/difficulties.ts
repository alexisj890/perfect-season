// How each difficulty is described on the landing page.

import type { Difficulty } from "@/lib/draft/config";

export interface DifficultyInfo {
  id: Difficulty;
  label: string;
  rivals: string;
}

export const DIFFICULTIES: DifficultyInfo[] = [
  {
    id: "easy",
    label: "Easy",
    rivals: "Rival managers chase big names and panic-buy. Room to build a juggernaut.",
  },
  {
    id: "normal",
    label: "Normal",
    rivals: "A couple of sharp managers among the chaos. A perfect season takes a great draft.",
  },
  {
    id: "hard",
    label: "Hard",
    rivals: "Several sharp managers in the league. Even a brilliant XI rarely wins them all.",
  },
];
