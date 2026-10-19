# Perfect Season

A football team-draft game with one goal: a perfect 35–0 season.

The concept is similar to Undefeated XI, with its own twist. You draft a super team from the
greatest players in the history of 16 European giants, from the 1960s to today. Then you try to
survive a full league season and a Champions League-style knockout without dropping a single
match.

Every run is different: a random draft position, rival managers with their own drafting habits,
and matches decided by player ratings, positions and chemistry.

## At a glance

- **Status:** playable from start to finish in the browser, as a guest. Accounts and cloud
  saves (Supabase) are in progress.
- **Requires:** Node.js 20.9 or later, and npm.
- **Saves:** your current run is saved in your browser and resumes where you left off.
- **Screens:** built for desktop first; phone layouts come later.

## How to play

### The draft

- Sixteen teams snake-draft from one shared pool of 194 legends. The order reverses every
  round, and you get a random draft position.
- Each pick fills an open slot in a 4-3-3. Once a player is taken, he's gone.
- You have 60 seconds per pick. When time runs out, the best available player is picked for
  you. The timer can be switched off in Settings.

### The season

- **League:** 30 matchdays, home and away. Three points for a win, one for a draw.
- **Playoffs:** the top 8 play two-legged quarter-finals and semi-finals, then a one-match final
  at a neutral venue. Level ties go to extra time, then penalties.
- **Watch or simulate:** watch any match as an animated replay, or simulate straight to the
  result.

### Season honours

| Honour | What it takes |
|---|---|
| Perfect season | Win all 35 matches: 30 league, 4 knockout legs and the final |
| Invincible season | Win the title without losing a match; draws are allowed |

Extra-time and shootout wins count as wins. A two-legged tie you go through counts as two
wins toward a Perfect season, even if you lost or drew one leg.

## What makes a team strong

- **Ratings:** each player has one rating from five criteria: individual quality, peak at the
  club, achievements, longevity and honours.
- **Position fit:** a player is strongest in his natural position and loses strength the further
  he plays from it, down to a keeper in an outfield slot.
- **Chemistry:** links between all 11 players: clubmates, countrymen and famous partnerships.
  Good chemistry gives an edge between close teams, never enough to beat a clearly better XI.
- **Home advantage:** a small boost for the home side; none in the final.

## Difficulty

Rival managers each have a hidden drafting style, from sharp to chaotic. The difficulty sets
how many of them draft well.

| Difficulty | Rival managers | Chance of 35–0 with a strong draft |
|---|---|---|
| Easy | Chase big names and panic-buy | About 1 run in 11 |
| Normal | A couple of sharp managers among the chaos | About 1 run in 35 |
| Hard | Several sharp managers | About 1 run in 380 |

## Clubs

Arsenal · Chelsea · Liverpool · Manchester City · Manchester United · Real Madrid ·
Atlético Madrid · Barcelona · AC Milan · Inter Milan · Juventus · Bayern Munich · Dortmund ·
PSG · Ajax · Napoli

Each club brings its all-time XI. Eighteen notable omissions (such as Lewandowski, Kahn and
Neymar) join the pool as extras.

## Getting started

1. Clone the repository and install the dependencies:

   ```bash
   git clone https://github.com/alexisj890/perfect-season.git
   cd perfect-season
   npm install
   ```

2. Start the development server:

   ```bash
   npm run dev
   ```

3. Open <http://localhost:3000> and press **Start a run**.

No account or keys are needed to play as a guest. Accounts will need a Supabase project:
see [docs/supabase-setup.md](docs/supabase-setup.md) and copy `.env.example` to `.env.local`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm test` | Run all tests once |
| `npm run test:watch` | Re-run tests on every save |
| `npm run lint` | Check the code with ESLint |
| `npm run sim -- "Barcelona" "Real Madrid"` | Play two club XIs and print the match |
| `npm run season -- 1 normal` | Auto-draft and play a whole season (seed, difficulty) |
| `npm run odds -- --difficulty normal` | Estimate win rates and 35–0 odds |
| `npm run perfect -- --difficulty easy` | Play full runs until one goes 35–0 |

Examples with every option:

```bash
npm run sim -- "Barcelona" "Real Madrid" 7 --final
npm run season -- 42 hard
npm run odds -- --drafts 40 --seasons 2000 --difficulty all
npm run perfect -- --difficulty normal --trials 5 --cap 3000
```

## Project structure

```text
app/          Pages, one URL per screen (landing, draft, season, match, playoffs, end)
components/   The game screens and their parts (React)
lib/          Game logic in plain TypeScript: draft, match engine, season, playoffs
data/         The player pool and game rules as CSV files
scripts/      Command-line simulations (sim, season, odds, perfect)
docs/         Setup guides
```

The match engine has no UI code. It is covered by tests, and all randomness comes from a
seeded generator, so a run can be reproduced exactly.

## Data

- `data/players.csv` holds all 194 players: 16 clubs × 11 slots, plus 18 extras.
- The other CSVs hold the formation, position fit, chemistry rules, iconic partnerships and
  derby rivalries.
- A player's rating is a weighted score:

  | Criterion | Weight |
  |---|---|
  | Individual quality | 35% |
  | Peak at the club | 30% |
  | Achievements | 20% |
  | Longevity | 10% |
  | Honours | 5% |

## Accessibility

- **Contrast:** text meets WCAG AA contrast in both themes, with muted text at AAA.
- **Colour:** results never rely on colour alone; every result also has a letter, number,
  sign or shape.
- **Settings:**
  - Larger text.
  - Turning off the draft timer.
  - A day / night theme.
- **Keyboard and screen readers:** a visible outline marks keyboard focus, and screen readers
  hear the draft timer's start and its 10-second warning.

## Built with

- [Next.js](https://nextjs.org) (App Router) and React
- TypeScript
- Tailwind CSS
- Vitest and React Testing Library
- Supabase for accounts and saved runs (in progress)

## Roadmap

- [x] Draft, league, playoffs and end screens
- [x] Match replays and player ratings
- [x] Difficulty levels, draft timer and accessibility settings
- [ ] Accounts: email sign-up and Google sign-in
- [ ] Cloud saves across devices
- [ ] Phone layouts
