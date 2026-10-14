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

// Sorted by points, then goal difference, then goals scored. Teams still level
// after that are separated by head-to-head results: a mini-table of only the
// matches between them (points, then goal difference, then goals). If even
// that is level, the lower team index (earlier draft position) goes first, so
// the order is always well defined.
export function standings(teamCount: number, matches: PlayedMatch[]): TableRow[] {
  const rows = tally(teamCount, matches);
  rows.sort(byPointsThenGoals);

  // Re-order each group of teams that are level on points, GD and goals.
  const ordered: TableRow[] = [];
  for (let i = 0; i < rows.length; ) {
    let j = i + 1;
    while (j < rows.length && byPointsThenGoals(rows[i], rows[j]) === 0) j++;
    const group = rows.slice(i, j);
    ordered.push(...(group.length > 1 ? headToHead(group, matches) : group));
    i = j;
  }
  return ordered;
}

function byPointsThenGoals(a: TableRow, b: TableRow): number {
  return b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor;
}

function headToHead(group: TableRow[], matches: PlayedMatch[]): TableRow[] {
  const teams = new Set(group.map((r) => r.team));
  const between = matches.filter((m) => teams.has(m.home) && teams.has(m.away));
  const mini = new Map(tally(Math.max(...teams) + 1, between).map((r) => [r.team, r]));
  return [...group].sort((a, b) => byPointsThenGoals(mini.get(a.team)!, mini.get(b.team)!) || a.team - b.team);
}

function tally(teamCount: number, matches: PlayedMatch[]): TableRow[] {
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
  return rows;
}
