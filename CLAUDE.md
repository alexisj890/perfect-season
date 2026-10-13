@AGENTS.md

# Perfect Season

A soccer team-draft web game inspired by 82-0. Sixteen all-time club XIs (1960s–present) form one shared player pool. Sixteen teams snake-draft from it, play a home-and-away league, then a Champions League-style knockout. The goal is a perfect 35–0 season.

## Stack
- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres) for data — not set up yet
- Vitest for tests

## Commands
- `npm run dev` — start the dev server at http://localhost:3000
- `npm run lint` — run ESLint

## Data
- `data/players.csv` — 176 players: 16 clubs × 11 slots in a 4-3-3, with ratings, positions, nationality, and years at club
- `data/chemistry_rules.csv`, `formation_slots.csv`, `formation_links.csv`, `iconic_pairs.csv`, `rivalries.csv`, `position_fit.csv`, `notable_omissions.csv`
- Treat these CSVs as the source of truth. Don't edit them unless I ask.

## Game rules
- **Draft:** 16-team snake draft (order reverses each round) from one shared pool; a drafted player is gone. No salary cap. The user gets a random draft position. Each pick must fill an open 4-3-3 slot. Computer teams take the best available player for an open slot, with slight randomness.
- **League:** home and away, 30 matchdays. 3 points for a win, 1 for a draw. Tiebreaks: goal difference, then goals scored.
- **Playoffs:** top 8 (1v8, 2v7, 3v6, 4v5). Quarter-finals and semi-finals are two legs; the higher seed hosts the second leg. Aggregate ties go to extra time, then penalties (no away goals). The final is one match at a neutral venue, with extra time and penalties.
- **Perfect season:** win all 35 matches (30 league + 4 knockout legs + final).

## Code rules
- The match engine is pure TypeScript with no React or UI imports, and is covered by Vitest tests.
- Formations live in data, never hard-coded.
- Game state (draft, season, playoffs) must be serializable so a run can be saved and resumed.
- Leave room for accounts later (nullable `user_id`), but don't build them yet.

## How to work with me
- I'm new to Next.js. Explain what you're changing and why in plain language.
- Plan before large changes; build one small milestone at a time.
- Suggest a commit after each working step.
- Never run `npm audit fix --force`.