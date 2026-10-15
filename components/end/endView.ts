// The end screen's words for each way a run can finish.

import type { RunRecap } from "@/lib/end/recap";
import { ordinal } from "@/components/season/NextMatchCard";

export type Honour = "perfect" | "invincible" | null;

export interface EndHeadline {
  kicker: string; // the small line above the title
  title: string;
  lines: string[]; // a sentence or two under the title
  champion: boolean;
  honour: Honour;
}

const ROUND_NAME = { QF: "quarter-finals", SF: "semi-finals" } as const;

export function endHeadline(recap: RunRecap): EndHeadline {
  const { outcome, overall, league, beatenBy, championName } = recap;
  const otherChampion = championName && championName !== recap.teamName ? `${championName} won the title.` : null;

  if (outcome.kind === "champion") {
    const honour: Honour = outcome.perfect ? "perfect" : outcome.invincible ? "invincible" : null;
    const finalLine = finalSummary(recap);
    if (honour === "perfect") {
      return { kicker: "Champions", title: "Perfect season", lines: ["35 matches, 35 wins.", finalLine], champion: true, honour };
    }
    if (honour === "invincible") {
      return {
        kicker: "Champions",
        title: "Invincible season",
        lines: [`Unbeaten in all 35: ${overall.won} wins and ${overall.drawn} ${overall.drawn === 1 ? "draw" : "draws"}.`, finalLine],
        champion: true,
        honour,
      };
    }
    return {
      kicker: `${ordinal(league.position)} in the league`,
      title: "Champions",
      lines: [finalLine, `${overall.won} wins from 35. The perfect season is still out there.`],
      champion: true,
      honour: null,
    };
  }

  if (outcome.kind === "eliminated") {
    const how =
      outcome.round === "Final" ? `Lost the final to ${beatenBy}.` : `Knocked out in the ${ROUND_NAME[outcome.round]} by ${beatenBy}.`;
    return {
      kicker: outcome.round === "Final" ? "Runners-up" : `${ordinal(league.position)} in the league`,
      title: "Better luck next time",
      lines: [how, ...(outcome.round === "Final" ? [] : otherChampion ? [otherChampion] : [])],
      champion: false,
      honour: null,
    };
  }

  // Relegated: missed the top 8.
  return {
    kicker: `${ordinal(league.position)} of ${league.teams}`,
    title: "Relegated",
    lines: [`Only the top 8 reach the playoffs.`, ...(otherChampion ? [otherChampion] : [])],
    champion: false,
    honour: null,
  };
}

// "Won the final 2–1 against Galácticos." / "… 1–1 against X, 4–3 on penalties."
function finalSummary(recap: RunRecap): string {
  const final = recap.knockouts.find((m) => m.key === "final");
  if (!final?.result) return "Won the final.";
  const r = final.result;
  const home = final.home === recap.user;
  const mine = home ? r.homeGoals : r.awayGoals;
  const theirs = home ? r.awayGoals : r.homeGoals;
  const opponent = recap.names[(home ? final.away : final.home)!];
  const extra = r.shootout
    ? `, ${home ? r.shootout.home : r.shootout.away}–${home ? r.shootout.away : r.shootout.home} on penalties`
    : r.extraTime
      ? " after extra time"
      : "";
  return `Won the final ${mine}–${theirs} against ${opponent}${extra}.`;
}
