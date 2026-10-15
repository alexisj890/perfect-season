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
- `npm run season -- [seed] [easy|normal|hard]` — auto-draft a league, play the season and playoffs, print the table, top scorers, bracket and the run's outcome
- `npm run odds -- [--drafts 20] [--seasons 400] [--difficulty normal] [--club-xis-only]` — Monte Carlo: win rates and 35–0 odds for strong/average/weak drafts (`--club-xis-only` drafts from the 176 club-XI players only). Rerun after any engine, draft or data change.

## Data
- `data/players.csv` — 194 players: 16 clubs × 11 slots in a 4-3-3 (the club XIs), plus 18 pool-only extras from `notable_omissions.csv` (`pool_only = yes`, at their assigned peak club, in the slot they'd naturally fill). Ratings, positions, nationality, and years at club.
- Rating (`weighted_score`) = 35% individual + 30% peak at club + 20% achievements + 10% longevity + 5% honours. Tier: S ≥ 93, A ≥ 88, B ≥ 83, C below. Cost ≈ 2 × (score − 75) $M.
- Pool-only players are draftable like anyone else but left out of club XIs (`clubLineup`, `lineupByRank`) and of the engine's average-XI yardstick (`averageRatings` in `lib/engine/team.ts`), so adding them doesn't shift match calibration.
- `data/chemistry_rules.csv`, `formation_slots.csv`, `formation_links.csv`, `iconic_pairs.csv`, `rivalries.csv`, `position_fit.csv`, `position_similarity.csv`, `notable_omissions.csv`
- Each player has only their one club in the data; career history at other clubs is deliberately left out for now.
- `lib/data/load.ts` reads the CSVs (server-only); `lib/data/load.test.ts` checks the data is consistent.
- Treat these CSVs as the source of truth. Don't edit them unless I ask.

## Game rules
- **Draft:** 16-team snake draft (order reverses each round) from one shared pool; a drafted player is gone. No salary cap. The user gets a random draft position. Each pick must fill an open 4-3-3 slot (any player, any open slot; fit penalties apply). The pool has 194 players for 176 picks, so 18 go undrafted each run.
- **Computer drafters and difficulty:** each computer team gets a style — balanced (best available + chemistry), ignores chemistry, star-chaser (biggest name, even out of position), panic-fill (rushes scarce slots) — plus randomness. The player picks Easy / Normal / Hard, which sets the style mix and how sloppy the computer is (`lib/draft/config.ts`). Targets: a strong draft goes 35–0 about 9% / 2.5% / 0.3% of the time (Easy / Normal / Hard). Last tuned for the 194-player pool: `npm run perfect` measured 9.2% / 2.9% / 0.26% over full runs. Retune whenever the pool or engine changes.
- **League:** home and away, 30 matchdays (double round-robin, circle method; matchdays 16–30 mirror 1–15 with venues swapped; no team plays three home or away games in a row). 3 points for a win, 1 for a draw. Tiebreaks: goal difference, then goals scored, then head-to-head (a mini-table of the matches between the teams still level: points, goal difference, goals), then draft position as a last resort.
- **Playoffs:** top 8 (1v8, 2v7, 3v6, 4v5). Fixed bracket, no re-seeding: the 1v8 winner meets the 4v5 winner, and 2v7 meets 3v6, so seeds 1 and 2 can only meet in the final. Quarter-finals and semi-finals are two legs; the lower seed hosts the first leg and the higher seed hosts the second. Aggregate ties go to extra time, then penalties (no away goals). The final is one match at a neutral venue, with extra time and penalties.
- **Perfect season:** win all 35 matches (30 league + 4 knockout legs + final). A match counts as a win if the user scores more in it (extra time included) or wins its penalty shootout. A two-legged tie counts as two wins whenever the user goes through, even after losing or drawing one leg.
- **Invincible season:** finish champion without losing a single match — wins and draws only (`invincibleSeason` in `lib/playoffs/outcome.ts`). Every match counts on its own: a lost knockout leg breaks it even if the user goes through; a drawn leg plus a won leg doesn't. A lost shootout counts as a defeat. A perfect season is also invincible; the honour shown is the higher one.
- **Position fit:** players may be drafted into any slot. Tiers in `position_fit.csv`: Natural, Secondary, Similar (`position_similarity.csv`), Out of position, Goalkeeper swap. Rating = `weighted_score` × the fit multiplier for the slot they're actually playing (not the CSV's `effective_rating`, which is for their original slot).
- **Chemistry:** scored across all 55 player pairs in the XI (FIFA-style), not just neighbouring slots. Worth up to ±15% expected goals — a real edge between close teams, never enough to beat a clearly better XI.
- **Extra time and penalties:** never in league matches or first legs. A second leg goes to extra time only if the aggregate is level after 90; extra-time goals count toward the aggregate, and penalties follow only if it's still level after 120. The final goes to extra time if level after 90, then penalties. Extra time is 30 minutes, so its goal rate is a third of a full match.
- **Penalty takers:** in order of attacking strength (rating weighted by how far forward their slot is), best first; the keeper shoots last.
- **Home advantage:** home team's expected goals × 1.07. Neutral venue (the final): no boost for either side.
- **Match difficulty:** rating gaps decide most matches (a good XI beats an average one ~86% of the time; mismatches have ~3% draws) while scorelines stay realistic (~3 goals between equal teams, ~4 in mismatches).
- **End of run** (`runOutcome` in `lib/playoffs/outcome.ts`): missed the top 8 → "Relegated" screen. Lost in the knockouts → "Better luck next time". Won the final → trophy and roster recap.
- **Match events:** the engine produces a timeline of shots (goal, saved, post, wide), corners, direct free kicks and in-match penalties, with scorers and assisters. Penalties and direct free kicks go to the most attacking player; corners to the best midfielder/winger. Each half has random stoppage time, shown as 90+3'. Shot and corner volume grow with the square root of expected goals (a dominant side takes ≈22 shots, not 40); goals still follow expected goals exactly.
- **Player ratings:** 0–10 per player per match, worked out from the saved events (`lib/engine/ratings.ts`): goals, assists, shots on target, saves, clean sheets, result, plus a small fixed per-player wobble. Display only — never affects results. Highest rating is Man of the Match. Season averages feed the Squad tab (and later the end screens).
- **Match replay** (`/match/[id]`, `lib/replay/replay.ts`): the engine decides the result first; a pure, deterministic replay script then acts it out (22 dots + ball, possession pushes, build-ups to each shot, every event inside its real minute, a restart gap after goals). It never changes a result. Plays like TV highlights: attacks (build-up, shot, save/goal) run near real time (`SLOW_RATE`), quiet spells fast, ≈3 minutes per match at 1× (`TARGET_REAL_SECONDS`). Shooters run into the box (limited to sprint speed), keepers dive, the ball is won by tackles (meet halfway) or interceptions (a pass cut out early), corners are won off a blocked shot (last touch always a defender), then taken from the flag into a packed box; tests guard against teleporting. Watch = play the matchday, then open the replay; Replay › rewatches.

## Code rules
- The match engine is pure TypeScript with no React or UI imports, and is covered by Vitest tests. All tuning numbers are in `lib/engine/config.ts`; the calibration tests in `lib/engine/match.test.ts` guard the difficulty.
- All randomness goes through the seeded RNG in `lib/rng.ts` — never `Math.random()` — so runs are reproducible.
- Formations live in data, never hard-coded.
- Game state (draft, season, playoffs) must be serializable so a run can be saved and resumed.
- Saves store match results, never just a seed to replay: any engine change alters what a seed produces, so replaying would rewrite past results.
- To keep saves small, the user's matches keep every event (for the replay); other matches keep only their goals.
- Accounts: Google sign-in via Supabase Auth, built together with database saves at the end of Milestone 6. Until then the home page shows the sign-in section with a disabled "coming soon" button. Guest play is always allowed (guests save in the browser); keep `user_id` nullable.

## UI decisions (Milestone 6)
- Desktop first; phone layouts later.
- Day / night theme toggle. Colours are CSS variables in `app/globals.css` (navy night, cool-grey day, gold accent; the day gold is a darker `#8a6500` so it reads as text).
- Readability rules (WCAG AA): text at least 4.5:1 against its background in both themes; nothing smaller than `text-xs`, which is 13px here; never colour alone — every coloured signal also has a letter, number, sign or shape (W/D/L letters, rating numbers, fit labels, +/−, the tracker's dot / ring / ×); muted text instead of `opacity-50` for de-emphasis; coloured pills use dark fills (`-700`/`-800`) with white text; theme-dependent colours use a `-700` shade by day and `-400` at night. Every focusable element shows a gold outline on keyboard focus.
- Settings → Larger text sets `<html data-text-size="large">`, which raises the text-size variables (not spacing) a step; applied before the first paint by `components/settingsScript.ts`. Layouts should survive it: let long names truncate (with a `title`) and keep buttons on one line.
- Fonts: Barlow everywhere; Barlow Condensed 800 only for the landing page's "35–0". Tabular numbers for stats.
- Landing page: calm and minimal — header (logo, account status, theme icon), "35–0" with 35 dots that fill in on load (the page's only animation; skipped with reduced motion), tagline, one main button (Continue [team] or Start a run), footer with data facts and the penalty practice modal.
- Starting a run is a pop-up on the landing page (`components/home/NewRunDialog.tsx`): team name + difficulty, then the draft-position reveal, then the draft room. Any link to `/?new` opens it (the end screen's Try again); the old `/new` URL redirects there (`next.config.ts`). Replacing a run in progress asks first.
- "Sim to end" (season and playoffs) asks for confirmation (`components/ui/ConfirmDialog.tsx`) while the user still has matches to skip. The button to the end screen is "See your season review" ("Skip to season review" when knocked out mid-playoffs).
- Computer teams are named after their drafting style, but styles are never shown to the player (names borrow from other styles' lists if one runs out).
- Draft room: computer picks play out one by one (300ms, skippable); ratings shown as whole numbers; pick by selecting a player, then a slot (on the pitch or the best-first fit chips).
- Draft timer: 60 seconds per user pick (`components/draft/DraftClock.tsx`), counting only while the tab is visible and restarting after a reload. At zero it auto-picks like the Auto-pick button (best-rated player for an open slot, `BEST_AVAILABLE`) and says what it picked. Screen readers hear the start and a 10-second warning. On by default; switched off in Settings.
- Settings (gear in the header, `components/SettingsMenu.tsx`): saved in the browser via `useSettings` (`components/useSettings.ts`, a shared store like `useSavedRun`). New settings get defaults automatically.
- Watching a match replay is optional; simulating is always available.
- One URL per screen: `/` (landing, with the new-run pop-up), `/draft`, `/season`, `/match/[id]`, `/playoffs`, `/end`. Pages (`app/`) load the CSV data on the server via `lib/data/gameData.ts` and pass it down; game screens (`components/screens/`) are client components that read the run from browser storage with `useSavedRun` (inside `<Suspense>`, using React's `use(browser())`).
- The whole attempt is one `RunState` (`lib/run.ts`); its phase is derived, never stored. `useRequirePhase` redirects to the right screen. A finished draft or season stays on its screen (summary card) until the player moves on (`startSeason` / `startPlayoffs`).
- Playoffs screen: bracket (QF → SF → final, legs + aggregate + aet/pens), Up next (Play / Watch / Sim to the end), Your path with replays. Knockout replays use keys like `qf-1-2` and `final`. After the final the run stays on the bracket until "See how it ended" (`endRun`, sets `ended`).
- Season hub: one-screen layout (next match, last result, table, results/scorers) with the 35-dot season tracker (`perfectTrack` in `lib/playoffs/outcome.ts`): one mark per match — solid gold dot win, hollow ring draw, red × loss, small dot still to play, faint dash never played.
- End screen (`/end`, `components/screens/EndScreen.tsx`): one layout for every ending — trophy (solid for champions, outline otherwise), title (Perfect season / Invincible season / Champions / Better luck next time / Relegated; words in `components/end/endView.ts`), the 35 dots, Try again (pre-fills the last team name and difficulty) and Back to home; then league finish and knockout path, the XI on a pitch with season average ratings, player of the season, top scorer and the squad ratings. Season numbers come from `runRecap` (`lib/end/recap.ts`), over all the user's matches (league + knockouts). A relegated run still plays out the playoffs (`leaveSeason`), so the end screen can name the champion.
- Next.js keeps up to 3 visited pages alive in the background (Activity, from `cacheComponents`) and restores their state. So: the saved run is one shared store (`useSavedRun`, built on `useSyncExternalStore`) rather than per-page state, and one-off UI like dialogs or confirmation messages resets itself when its page is hidden (`useLayoutEffect` cleanup).
- Add `?dev` to any URL for the dev panel (finish draft / season / playoffs, delete run).
- Component tests: `*.test.tsx` with `// @vitest-environment jsdom` and React Testing Library.

## Ideas parked for later
- Form, fatigue, injuries and red cards (left out for now: more complexity, and they make a perfect season more about luck).
- Chemistry-aware drafting ("balanced") did slightly worse than plain best-available in simulations — the draft may overvalue chemistry. Worth revisiting.

- Star-chaser computer teams are very weak (blowouts against them are common). Kept on purpose for now: blowouts are satisfying.

## How to work with me
- I'm new to Next.js. Explain what you're changing and why in plain language.
- Plan before large changes; build one small milestone at a time.
- Suggest a commit after each working step.
- Never run `npm audit fix --force`.