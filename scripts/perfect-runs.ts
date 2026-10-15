// How long does a perfect 35–0 season take on each difficulty?
//
// Plays complete runs with the real game code — start a run, draft, play the
// league matchday by matchday, then the real playoffs — and keeps starting new
// runs until one goes 35–0, counting how many it took. An attempt stops as soon
// as the user drops a result, so failed attempts are cheap. Each "trial" is one
// hunt for a perfect season; several trials give a typical number of runs.
//
// The user's picks are made automatically in a chosen style:
//   strong   sharp best-available (how a good human drafts)
//   average  chases chemistry, with some mistakes
//
// Usage: npm run perfect -- [--difficulty all|easy|normal|hard] [--profile strong|average|all]
//                            [--trials 5] [--cap 3000] [--minutes 10]

import { loadGameData } from "@/lib/data/load";
import type { Difficulty } from "@/lib/draft/config";
import { autoDraft, type Drafter } from "@/lib/draft/cpu";
import { perfectSeason } from "@/lib/playoffs/outcome";
import { isPlayoffsComplete } from "@/lib/playoffs/playoffs";
import { playLeague, playPlayoffs, startPlayoffs, startRun, startSeason, userTeam, type RunState } from "@/lib/run";
import { isSeasonComplete, teamRecord } from "@/lib/season/season";

const args = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const DIFFICULTIES: Difficulty[] = arg("difficulty", "all") === "all" ? ["easy", "normal", "hard"] : [arg("difficulty", "") as Difficulty];
const PROFILES: Record<string, Drafter> = {
  strong: { style: "ignoresChemistry", candidates: 2, temperature: 0.5 },
  average: { style: "balanced", candidates: 4, temperature: 1.5 },
};
const profileNames = arg("profile", "strong") === "all" ? Object.keys(PROFILES) : [arg("profile", "strong")];
const TRIALS = Number(arg("trials", "5"));
const CAP = Number(arg("cap", "3000")); // give up a trial after this many runs
const MINUTES_PER_RUN = Number(arg("minutes", "10")); // a human's time per run, for the estimate

const data = loadGameData();

type Ending = "perfect" | "league" | "playoffs";

// Plays one run until it's perfect or the user drops a result.
function attempt(seed: number, difficulty: Difficulty, drafter: Drafter): { ending: Ending; wins: number } {
  let run: RunState = startRun(data, { id: `p-${seed}`, createdAt: "", seed, difficulty });
  run = startSeason({ ...run, draft: autoDraft(run.draft, data, drafter) });
  const me = userTeam(run);

  while (!isSeasonComplete(run.season!)) {
    run = playLeague(run, data, "matchday");
    const record = teamRecord(run.season!, me);
    if (!record.stillPerfect) return { ending: "league", wins: record.won };
  }
  run = startPlayoffs(run);
  while (!isPlayoffsComplete(run.playoffs!)) {
    run = playPlayoffs(run, data, "step");
    const progress = perfectSeason(run.season!, run.playoffs, me);
    if (!progress.alive) return { ending: "playoffs", wins: progress.wins };
  }
  return perfectSeason(run.season!, run.playoffs, me).perfect ? { ending: "perfect", wins: 35 } : { ending: "playoffs", wins: 0 };
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}

function humanTime(runs: number): string {
  const minutes = runs * MINUTES_PER_RUN;
  if (minutes < 120) return `~${Math.round(minutes)} min`;
  if (minutes < 60 * 48) return `~${(minutes / 60).toFixed(1)} hours`;
  return `~${(minutes / 60 / 24).toFixed(1)} days`;
}

console.log(`${TRIALS} trials per row · a trial gives up after ${CAP} runs · time estimate assumes ${MINUTES_PER_RUN} min per run\n`);

let seedBase = 1;
for (const profileName of profileNames) {
  const drafter = PROFILES[profileName];
  for (const difficulty of DIFFICULTIES) {
    const started = performance.now();
    const runsNeeded: number[] = [];
    let totalRuns = 0;
    let perfects = 0;
    let lostInLeague = 0;
    let lostInPlayoffs = 0;
    let bestFailure = 0;
    for (let trial = 0; trial < TRIALS; trial++) {
      let runs = 0;
      let found = false;
      while (runs < CAP && !found) {
        runs++;
        const result = attempt(seedBase++, difficulty, drafter);
        if (result.ending === "perfect") found = true;
        else {
          if (result.ending === "league") lostInLeague++;
          else lostInPlayoffs++;
          bestFailure = Math.max(bestFailure, result.wins);
        }
      }
      totalRuns += runs;
      if (found) {
        perfects++;
        runsNeeded.push(runs);
      }
      process.stdout.write(`  ${profileName}/${difficulty} trial ${trial + 1}: ${found ? `perfect on run ${runs}` : `none in ${runs} runs`}\n`);
    }
    const chance = perfects / totalRuns;
    const typical = runsNeeded.length ? median(runsNeeded) : null;
    console.log(
      `\n${profileName.toUpperCase()} draft · ${difficulty.toUpperCase()}\n` +
        `  perfect seasons: ${perfects} in ${totalRuns} runs → about 1 in ${chance > 0 ? Math.round(1 / chance) : `>${totalRuns}`} (${(chance * 100).toFixed(2)}%)\n` +
        (typical !== null
          ? `  runs needed per trial: ${runsNeeded.join(", ")} → median ${typical}, average ${Math.round(runsNeeded.reduce((a, b) => a + b, 0) / runsNeeded.length)}\n` +
            `  at ${MINUTES_PER_RUN} min a run: typically ${humanTime(typical)} of play\n`
          : `  no perfect season within ${CAP} runs per trial\n`) +
        `  failed runs ended in the league ${lostInLeague}× and in the playoffs ${lostInPlayoffs}× · best failed run: ${bestFailure} wins in a row\n` +
        `  (simulated in ${((performance.now() - started) / 1000).toFixed(0)} s)\n`,
    );
  }
}
