// Auto-drafts a league, plays the full 30-matchday season and prints the table.
// Usage: npm run season -- [seed] [easy|normal|hard]

import { loadGameData } from "@/lib/data/load";
import type { Difficulty } from "@/lib/draft/config";
import { autoDraft } from "@/lib/draft/cpu";
import { createDraft, lineupOf, userTeamIndex } from "@/lib/draft/draft";
import { buildTeam } from "@/lib/engine/team";
import { createSeason, leagueTable, playRestOfSeason, teamRecord, topScorers } from "@/lib/season/season";

const [seedText, difficultyText = "normal"] = process.argv.slice(2);
const seed = seedText ? Number(seedText) : Date.now();
const difficulty = difficultyText as Difficulty;

const data = loadGameData();
const nameOf = (id: string) => data.players.find((p) => p.id === id)?.name ?? id;

// The user's picks are made automatically here, drafting sharply.
const draft = autoDraft(createDraft(data, seed, difficulty), data, {
  style: "ignoresChemistry",
  candidates: 2,
  temperature: 0.5,
});
const user = userTeamIndex(draft);
const teams = draft.teams.map((_, i) => buildTeam(lineupOf(draft, i), data));
const season = playRestOfSeason(createSeason(teams.length, seed, user), teams);

const label = (i: number) => {
  const t = draft.teams[i];
  return t.isUser ? `${t.name} (you)` : `${t.name} [${t.style}]`;
};

console.log(`Season — seed ${seed}, ${difficulty}\n`);
console.log("Pos  Team                          P   W   D   L   GF  GA   GD  Pts");
leagueTable(season).forEach((r, i) => {
  const zone = i === 7 ? "\n     ─── playoff line ───" : "";
  console.log(
    `${String(i + 1).padStart(3)}  ${label(r.team).padEnd(28)}` +
      [r.played, r.won, r.drawn, r.lost, r.goalsFor, r.goalsAgainst].map((n) => String(n).padStart(4)).join("") +
      `${(r.goalDifference > 0 ? "+" : "") + r.goalDifference}`.padStart(5) +
      String(r.points).padStart(5) +
      zone,
  );
});

const rec = teamRecord(season, user);
console.log(`\nYour record: ${rec.won}W ${rec.drawn}D ${rec.lost}L` + (rec.stillPerfect ? " — PERFECT so far!" : ""));

console.log("\nTop scorers");
for (const s of topScorers(season).slice(0, 5)) {
  console.log(`  ${String(s.goals).padStart(3)}  ${nameOf(s.playerId)} (${label(s.team)}), ${s.assists} assists`);
}
