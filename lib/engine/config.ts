// Every tuning number for the match engine lives here.
//
// Calibrated (20,000 simulated matches each, home and away alternating) so that:
//   very strong XI (2nd–3rd best at each slot) vs average XI (8th–9th best): ~90% wins
//   two average XIs: ~2.9 goals per game, ~24% draws
//   elite XI (best at every slot) vs very strong XI: ~71% wins
//   two evenly matched XIs, one with full chemistry: ~+6 points of win rate —
//     an edge between close teams, never enough to beat a clearly better XI
// The calibration test in match.test.ts fails if a change moves these too far.

export const ENGINE = {
  // Goals each side expects in 90 minutes when both teams are average.
  baseGoals: 1.2,
  // How strongly a rating gap changes expected goals. Each rating point of
  // attack-over-defence multiplies expected goals by about e^ratingSensitivity.
  ratingSensitivity: 0.24,
  // Rating gaps (in points) beyond roughly this size stop adding much.
  ratingGapCap: 6,
  // Home team's expected goals are multiplied by this. Neutral venues use 1.
  homeAdvantage: 1.07,
  // Extra time length. Goal rates scale with it: 30 minutes ≈ a third of a match.
  extraTimeMinutes: 30,
  // Chemistry can change a team's expected goals by at most ± this fraction…
  chemistryMaxEffect: 0.1,
  // …reached when the team's total chemistry (all 55 pairs) hits this many points.
  // Typical mixed drafts total about 5–20; a draft built for chemistry can reach 40.
  chemistryForMaxEffect: 40,
  // Share of open-play goals that have an assist.
  assistChance: 0.8,
  // Where chances come from. `goalShare`: share of all goals from this source.
  // `conversion`: share of attempts from this source that go in. Together these
  // give ≈12 shots per team per match, close to real football.
  chanceSources: {
    "open play": { goalShare: 0.8, conversion: 0.1 },
    corner: { goalShare: 0.1, conversion: 0.07 },
    "free kick": { goalShare: 0.04, conversion: 0.07 },
    penalty: { goalShare: 0.06, conversion: 0.78 },
  },
  // Corners that don't lead to a shot, per expected goal (≈5 corners per team in total).
  extraCornersPerExpectedGoal: 2.5,
  // How a shot that doesn't go in ends up.
  missOutcomes: { saved: 0.37, post: 0.05, wide: 0.58 },
  penaltyMissOutcomes: { saved: 0.7, post: 0.1, wide: 0.2 },
  // Corners are taken by the best-rated player whose slot sits in this attack-weight
  // band (100 − pitch_y): central and attacking midfielders and wingers.
  cornerTakerBand: { min: 40, max: 85 },
  // Stoppage time added to each half, in whole minutes [min, max].
  stoppageTime: {
    firstHalf: [1, 4],
    secondHalf: [2, 7],
    extraTimeHalf: [0, 2],
  },
  // Penalty conversion for an average taker against an average keeper,
  // and how much each rating point of taker-over-keeper changes it.
  penaltyBaseChance: 0.76,
  penaltySkillEffect: 0.004,
  penaltyChanceMin: 0.55,
  penaltyChanceMax: 0.92,
} as const;
