// Auto-drafts a league, plays the full 30-matchday season and the playoffs,
// and prints the table, the bracket and how the user's run ended.
// Usage: npm run season -- [seed] [easy|normal|hard]

import { loadGameData } from "@/lib/data/load";
import type { Difficulty } from "@/lib/draft/config";
import { autoDraft } from "@/lib/draft/cpu";
import { createDraft, lineupOf, userTeamIndex } from "@/lib/draft/draft";
import { buildTeam } from "@/lib/engine/team";
import type { MatchResult } from "@/lib/engine/match";
import { perfectSeason, runOutcome } from "@/lib/playoffs/outcome";
import {
  champion,
  createPlayoffs,
  playRestOfPlayoffs,
  seedOf,
  tieAggregate,
  tieWinner,
  type PlayoffState,
  type Tie,
} from "@/lib/playoffs/playoffs";
import { createSeason, leagueTable, playRestOfSeason, teamRecord, topScorers } from "@/lib/season/season";

const [seedText, difficultyText = "normal"] = process.argv.slice(2);
const seed = seedText ? Number(seedText) : Date.now();
const difficulty = difficultyText as Difficulty;

const data = loadGameData();
const nameOf = (id: string) => data.players.find((p) => p.id === id)?.name ?? id;

// The user's picks are made automatically here, drafting sharply.
const draft = autoDraft(createDraft(data, seed, { difficulty }), data, {
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

// ---------------------------------------------------------------------------
// Playoffs

const table = leagueTable(season);
// The top 8 play the playoffs whether or not the user qualified.
const playoffs: PlayoffState = playRestOfPlayoffs(createPlayoffs(table, seed, user), teams);

const short = (i: number) => `(${seedOf(playoffs, i)}) ${draft.teams[i].isUser ? "Your XI" : draft.teams[i].name}`;
const extras = (r: MatchResult) =>
  r.shootout ? ` (aet, ${r.shootout.home}–${r.shootout.away} pens)` : r.extraTime ? " (aet)" : "";

function printTie(t: Tie) {
  const agg = tieAggregate(t)!;
  const winner = tieWinner(t)!;
  console.log(
    `  ${short(t.higher).padEnd(16)} vs ${short(t.lower).padEnd(16)}` +
      ` leg 1 ${t.leg1!.awayGoals}–${t.leg1!.homeGoals}, leg 2 ${t.leg2!.homeGoals}–${t.leg2!.awayGoals}${extras(t.leg2!)}` +
      ` → agg ${agg.higher}–${agg.lower}, ${short(winner)} through`,
  );
}

{
  console.log("\nQuarter-finals");
  playoffs.quarterFinals.forEach(printTie);
  console.log("\nSemi-finals");
  playoffs.semiFinals.forEach(printTie);
  const f = playoffs.final!;
  console.log(`\nFinal (neutral venue)\n  ${short(f.home)} ${f.result!.homeGoals}–${f.result!.awayGoals} ${short(f.away)}${extras(f.result!)}`);
  console.log(`  Champions: ${short(champion(playoffs)!)}`);
}

const outcome = runOutcome(season, playoffs, user);
const progress = perfectSeason(season, playoffs, user);
const message = {
  relegated: "Relegated — you missed the top 8.",
  eliminated: `Better luck next time — knocked out in the ${outcome.kind === "eliminated" ? outcome.round : ""}.`,
  champion: outcome.kind === "champion" && outcome.perfect ? "PERFECT SEASON — 35–0!" : "Champions!",
  inProgress: "Still in progress.",
}[outcome.kind];
console.log(`\n${message}  (perfect-season count: ${progress.wins}/${progress.target})`);
