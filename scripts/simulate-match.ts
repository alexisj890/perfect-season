// Plays two all-time club XIs against each other and prints the match.
// Usage: npm run sim -- "Barcelona" "Real Madrid" [seed] [--final]

import { loadGameData } from "@/lib/data/load";
import { clubLineup } from "@/lib/engine/lineups";
import { formatClock, matchStats, simulateMatch, type MatchEvent, type ShotOutcome } from "@/lib/engine/match";
import { buildTeam } from "@/lib/engine/team";
import { createRng } from "@/lib/rng";

const args = process.argv.slice(2);
const isFinal = args.includes("--final");
const [homeClub = "Barcelona", awayClub = "Real Madrid", seedText] = args.filter((a) => a !== "--final");
const seed = seedText ? Number(seedText) : Date.now();

const data = loadGameData();
const clubs = new Set(data.players.map((p) => p.club));
for (const club of [homeClub, awayClub]) {
  if (!clubs.has(club)) throw new Error(`Unknown club "${club}". Try one of: ${[...clubs].join(", ")}`);
}
const nameOf = (id: string) => data.players.find((p) => p.id === id)?.name ?? id;
const home = buildTeam(clubLineup(data, homeClub), data);
const away = buildTeam(clubLineup(data, awayClub), data);
const clubOf = (side: "home" | "away") => (side === "home" ? homeClub : awayClub);

const describeTeam = (club: string, t: typeof home) =>
  `${club}: attack ${t.attack.toFixed(1)}, defence ${t.defence.toFixed(1)}, chemistry ${t.chemistry} (×${t.chemistryFactor.toFixed(3)})`;
console.log(describeTeam(homeClub, home));
console.log(describeTeam(awayClub, away));

const r = simulateMatch(home, away, createRng(seed), { kind: isFinal ? "final" : "league" });

const MISS: Record<Exclude<ShotOutcome, "goal">, string> = { saved: "saved", post: "hits the post", wide: "wide" };
const SOURCE = { "open play": "", corner: " (header from a corner)", "free kick": " (free kick)", penalty: " (penalty)" };

function describeEvent(e: MatchEvent): string {
  const who = `${clubOf(e.side)}:`;
  if (e.type === "corner") return `   ⚑  ${who} corner, taken by ${nameOf(e.takerId)}`;
  if (e.outcome === "goal") {
    const assist = e.assistId ? `, assist ${nameOf(e.assistId)}` : "";
    return `⚽ GOAL ${who} ${nameOf(e.shooterId)}${SOURCE[e.source]}${assist}`;
  }
  return `   ·  ${who} ${nameOf(e.shooterId)}${SOURCE[e.source]} — ${MISS[e.outcome]}`;
}

console.log(`\n${homeClub} ${r.homeGoals}–${r.awayGoals} ${awayClub}${r.extraTime ? " (after extra time)" : ""}   [seed ${seed}]\n`);
r.events.forEach((e, i) => {
  // Skip quiet corners (ones not followed by that side's header) to keep the log short.
  const next = r.events[i + 1];
  const ledToShot = next?.type === "shot" && next.source === "corner" && next.side === e.side;
  if (e.type === "corner" && !ledToShot) return;
  console.log(`${formatClock(e).padStart(7)}  ${describeEvent(e)}`);
});

const st = r.stoppageTime;
console.log(`\nStoppage time: +${st.firstHalf} / +${st.secondHalf}` +
  (st.extraTimeFirstHalf !== null ? `, extra time +${st.extraTimeFirstHalf} / +${st.extraTimeSecondHalf}` : ""));

const stats = matchStats(r);
const row = (label: string, key: keyof typeof stats.home) =>
  `  ${label.padEnd(16)}${String(stats.home[key]).padStart(3)}  ${String(stats.away[key]).padStart(3)}`;
console.log(`\n${"".padEnd(18)}${homeClub.slice(0, 3).toUpperCase()}  ${awayClub.slice(0, 3).toUpperCase()}`);
console.log([row("Shots", "shots"), row("On target", "shotsOnTarget"), row("Corners", "corners"), row("Woodwork", "woodwork")].join("\n"));

if (r.shootout) {
  console.log(`\nPenalties: ${r.shootout.home}–${r.shootout.away}`);
  for (const k of r.shootout.kicks) {
    const result = k.outcome === "goal" ? "✓ scores" : `✗ ${MISS[k.outcome]}`;
    console.log(`  ${clubOf(k.side)}: ${nameOf(k.takerId)} ${result}`);
  }
}
if (r.winner) console.log(`\nWinner: ${clubOf(r.winner)}`);
