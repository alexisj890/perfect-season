// Tuning numbers for the draft.

import type { DraftStyle } from "./styles";

export type Difficulty = "easy" | "normal" | "hard";

export interface DrafterSettings {
  // How likely each computer team is to get each style (relative weights).
  styles: Record<DraftStyle, number>;
  // A drafter looks at its best few options…
  candidates: number;
  // …and picks among them with weight e^(−gap / temperature), where gap is how
  // many rating points worse an option is than its best. Lower = sharper.
  temperature: number;
}

export const DRAFT = {
  teamCount: 16,
  // Tuned with `npm run odds` on the 194-player pool for a strong draft's
  // 35–0 odds of about 9% / 2.5% / 0.3% (see CLAUDE.md).
  difficulties: {
    easy: {
      styles: { balanced: 0, ignoresChemistry: 1, starChaser: 5, panicFill: 5 },
      candidates: 7,
      temperature: 5.5,
    },
    normal: {
      styles: { balanced: 1, ignoresChemistry: 1, starChaser: 5, panicFill: 5 },
      candidates: 7,
      temperature: 4,
    },
    hard: {
      styles: { balanced: 1, ignoresChemistry: 1, starChaser: 3, panicFill: 3 },
      candidates: 5,
      temperature: 2.5,
    },
  } satisfies Record<Difficulty, DrafterSettings>,
} as const;
