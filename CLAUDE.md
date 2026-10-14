@AGENTS.md

# Perfect Season

A soccer team-draft web game inspired by 82-0. Sixteen all-time club XIs (1960s–present) form one shared player pool. Sixteen teams snake-draft from it, play a home-and-away league, then a Champions League-style knockout. The goal is a perfect 35–0 season.

## Stack
- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres) for saved runs — not set up yet. Player/reference data stays in the CSVs and is not copied into the database.
- Vitest for tests

## Commands
- `npm run dev` — start the dev server at http://localhost:3000
- `npm run lint` — run ESLint
- `npm test` — run the Vitest tests once (`npm run test:watch` re-runs them on every save)
- `npm run sim -- "Barcelona" "Real Madrid" [seed] [--final]` — play two club XIs and print the match
- `npm run season -- [seed] [easy|normal|hard]` — auto-draft a league, play the 30-matchday season, print the table and top scorers
- `npm run odds -- [--drafts 20] [--seasons 400] [--difficulty normal]` — Monte Carlo: win rates and 35–0 odds for strong/average/weak drafts. Rerun after any engine or draft tuning change.

## Data
- `data/players.csv` — 176 players: 16 clubs × 11 slots in a 4-3-3, with ratings, positions, nationality, and years at club
- `data/chemistry_rules.csv`, `formation_slots.csv`, `formation_links.csv`, `iconic_pairs.csv`, `rivalries.csv`, `position_fit.csv`, `position_similarity.csv`, `notable_omissions.csv`
- Each player has only their one club in the data; career history at other clubs is deliberately left out for now.
- `lib/data/load.ts` reads the CSVs (server-only); `lib/data/load.test.ts` checks the data is consistent.
- Treat these CSVs as the source of truth. Don't edit them unless I ask.

## Game rules
- **Draft:** 16-team snake draft (order reverses each round) from one shared pool; a drafted player is gone. No salary cap. The user gets a random draft position. Each pick must fill an open 4-3-3 slot (any player, any open slot; fit penalties apply). The pool is exactly 16 × 11, so every player is drafted.
- **Computer drafters and difficulty:** each computer team gets a style — balanced (best available + chemistry), ignores chemistry, star-chaser (biggest name, even out of position), panic-fill (rushes scarce slots) — plus randomness. The player picks Easy / Normal / Hard, which sets the style mix and how sloppy the computer is (`lib/draft/config.ts`). Targets: a strong draft goes 35–0 about 9% / 2.5% / 0.3% of the time (Easy / Normal / Hard).
- **League:** home and away, 30 matchdays (double round-robin, circle method; matchdays 16–30 mirror 1–15 with venues swapped; no team plays three home or away games in a row). 3 points for a win, 1 for a draw. Tiebreaks: goal difference, then goals scored, then head-to-head (a mini-table of the matches between the teams still level: points, goal difference, goals), then draft position as a last resort.
- **Playoffs:** top 8 (1v8, 2v7, 3v6, 4v5). Quarter-finals and semi-finals are two legs; the higher seed hosts the second leg. Aggregate ties go to extra time, then penalties (no away goals). The final is one match at a neutral venue, with extra time and penalties.
- **Perfect season:** win all 35 matches (30 league + 4 knockout legs + final). A match counts as a win if the user scores more in it (extra time included) or wins its penalty shootout. A two-legged tie counts as two wins whenever the user goes through, even after losing or drawing one leg.
- **Position fit:** players may be drafted into any slot. Tiers in `position_fit.csv`: Natural, Secondary, Similar (`position_similarity.csv`), Out of position, Goalkeeper swap. Rating = `weighted_score` × the fit multiplier for the slot they're actually playing (not the CSV's `effective_rating`, which is for their original slot).
- **Chemistry:** scored across all 55 player pairs in the XI (FIFA-style), not just neighbouring slots. Worth up to ±15% expected goals — a real edge between close teams, never enough to beat a clearly better XI.
- **Extra time and penalties:** never in league matches or first legs. A second leg goes to extra time only if the aggregate is level after 90; extra-time goals count toward the aggregate, and penalties follow only if it's still level after 120. The final goes to extra time if level after 90, then penalties. Extra time is 30 minutes, so its goal rate is a third of a full match.
- **Penalty takers:** in order of attacking strength (rating weighted by how far forward their slot is), best first; the keeper shoots last.
- **Home advantage:** home team's expected goals × 1.07. Neutral venue (the final): no boost for either side.
- **Match difficulty:** rating gaps decide most matches (a good XI beats an average one ~86% of the time; mismatches have ~3% draws) while scorelines stay realistic (~3 goals between equal teams, ~4 in mismatches).
- **End of run:** missed the top 8 → "Relegated" screen. Lost in the knockouts → "Better luck next time". Won the final → trophy and roster recap.
- **Match events:** the engine produces a timeline of shots (goal, saved, post, wide), corners, direct free kicks and in-match penalties, with scorers and assisters. Penalties and direct free kicks go to the most attacking player; corners to the best midfielder/winger. Each half has random stoppage time, shown as 90+3'.
- **Match animation:** the engine decides the result and the event timeline first; the UI replays it as dots on a 2D pitch.

## Code rules
- The match engine is pure TypeScript with no React or UI imports, and is covered by Vitest tests. All tuning numbers are in `lib/engine/config.ts`; the calibration tests in `lib/engine/match.test.ts` guard the difficulty.
- All randomness goes through the seeded RNG in `lib/rng.ts` — never `Math.random()` — so runs are reproducible.
- Formations live in data, never hard-coded.
- Game state (draft, season, playoffs) must be serializable so a run can be saved and resumed.
- Saves store match results, never just a seed to replay: any engine change alters what a seed produces, so replaying would rewrite past results.
- To keep saves small, the user's matches keep every event (for the replay); other matches keep only their goals.
- Leave room for accounts later (nullable `user_id`), but don't build them yet.

## Ideas parked for later
- Form, fatigue, injuries and red cards (left out for now: more complexity, and they make a perfect season more about luck).
- Chemistry-aware drafting ("balanced") did slightly worse than plain best-available in simulations — the draft may overvalue chemistry. Worth revisiting.

- Star-chaser computer teams are very weak (blowouts against them are common). Kept on purpose for now: blowouts are satisfying.

## How to work with me
- I'm new to Next.js. Explain what you're changing and why in plain language.
- Plan before large changes; build one small milestone at a time.
- Suggest a commit after each working step.
- Never run `npm audit fix --force`.