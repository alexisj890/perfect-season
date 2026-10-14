// The league table, worked out from results every time (never stored), so it
// can't drift out of step with the matches.

export interface PlayedMatch {
  home: number; // team index
  away: number;
  homeGoals: number;
  awayGoals: number;
}

export interface TableRow {
  team: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export const POINTS = { win: 3, draw: 1, loss: 0 } as const;

// Sorted by points, then goal difference, then goals scored. If teams are
// still level after that, the lower team index (earlier draft position) goes
// first, so the order is always well defined.
export function standings(teamCount: number, matches: PlayedMatch[]): TableRow[] {
  const rows: TableRow[] = Array.from({ length: teamCount }, (_, team) => ({
    team,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  }));

  const record = (row: TableRow, scored: number, conceded: number) => {
    row.played++;
    row.goalsFor += scored;
    row.goalsAgainst += conceded;
    row.goalDifference = row.goalsFor - row.goalsAgainst;
    if (scored > conceded) {
      row.won++;
      row.points += POINTS.win;
    } else if (scored === conceded) {
      row.drawn++;
      row.points += POINTS.draw;
    } else {
      row.lost++;
      row.points += POINTS.loss;
    }
  };

  for (const m of matches) {
    record(rows[m.home], m.homeGoals, m.awayGoals);
    record(rows[m.away], m.awayGoals, m.homeGoals);
  }

  return rows.sort(
    (a, b) =>
      b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.team - b.team,
  );
}
