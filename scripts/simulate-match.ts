// Plays two all-time club XIs against each other and prints the match.
// Usage: npm run sim -- "Barcelona" "Real Madrid" [seed] [--final]

import { loadGameData } from "@/lib/data/load";
import { simulateMatch } from "@/lib/engine/match";
import { buildTeam } from "@/lib/engine/team";
import { clubLineup } from "@/lib/engine/testTeams";
import { createRng } from "@/lib/rng";

const args = process.argv.slice(2);
const isFinal = args.includes("--final");
const [homeClub = "Barcelona", awayClub = "Real Madrid", seedText] = args.filter((a) => a !== "--final");
const seed = seedText ? Number(seedText) : Date.now();

const data = loadGameData();
const nameOf = new Map(data.players.map((p) => [p.id, p.name]));
const home = buildTeam(clubLineup(data, homeClub), data);
const away = buildTeam(clubLineup(data, awayClub), data);
if (home.players.length === 0 || away.players.length === 0) throw new Error("Unknown club name");

const describe = (club: string, t: typeof home) =>
  `${club}: attack ${t.attack.toFixed(1)}, defence ${t.defence.toFixed(1)}, chemistry ${t.chemistry} (×${t.chemistryFactor.toFixed(3)})`;
console.log(describe(homeClub, home));
console.log(describe(awayClub, away));

const r = simulateMatch(home, away, createRng(seed), { kind: isFinal ? "final" : "league" });

console.log(`\n${homeClub} ${r.homeGoals}–${r.awayGoals} ${awayClub}${r.extraTime ? " (after extra time)" : ""}   [seed ${seed}]`);
for (const g of r.goals) {
  const assist = g.assistId ? ` (assist: ${nameOf.get(g.assistId)})` : "";
  console.log(`  ${String(g.minute).padStart(3)}'  ${g.side === "home" ? homeClub : awayClub}: ${nameOf.get(g.scorerId)}${assist}`);
}
if (r.shootout) {
  console.log(`\nPenalties: ${r.shootout.home}–${r.shootout.away}`);
  for (const k of r.shootout.kicks) {
    console.log(`  ${k.scored ? "✓" : "✗"} ${k.side === "home" ? homeClub : awayClub}: ${nameOf.get(k.takerId)}`);
  }
}
if (r.winner) console.log(`\nWinner: ${r.winner === "home" ? homeClub : awayClub}`);
