// The league table, with a line under the playoff places and the user's row highlighted.

import type { TableRow } from "@/lib/season/standings";
import { FormChips } from "./FormChips";
import type { FormLetter } from "./seasonView";

interface Props {
  rows: TableRow[];
  names: string[];
  user: number;
  playoffPlaces: number;
  formOf: (team: number) => FormLetter[];
}

export function LeagueTable({ rows, names, user, playoffPlaces, formOf }: Props) {
  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-border bg-surface" aria-label="League table">
      <div className="min-h-0 overflow-y-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="sticky top-0 bg-surface text-xs text-muted">
            <tr>
              <th className="py-1.5 pl-4 pr-2 text-right font-semibold">#</th>
              <th className="px-2 text-left font-semibold">Team</th>
              {["P", "W", "D", "L", "GD", "Pts"].map((h) => (
                <th key={h} className="px-1.5 text-right font-semibold">
                  {h}
                </th>
              ))}
              <th className="pl-2 pr-4 text-left font-semibold">Form</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.team}
                className={`${r.team === user ? "bg-accent/10 font-semibold" : ""} ${
                  i === playoffPlaces - 1 ? "border-b-2 border-dashed border-accent/50" : "border-b border-border/50"
                }`}
              >
                <td className="py-1 pl-4 pr-2 text-right text-muted">{i + 1}</td>
                {/* Takes whatever room is left (and truncates), so the form chips always fit. */}
                <td className={`w-full max-w-0 truncate px-2 ${r.team === user ? "text-accent" : ""}`} title={names[r.team]}>
                  {names[r.team]}
                </td>
                <td className="px-1.5 text-right">{r.played}</td>
                <td className="px-1.5 text-right">{r.won}</td>
                <td className="px-1.5 text-right">{r.drawn}</td>
                <td className="px-1.5 text-right">{r.lost}</td>
                <td className="px-1.5 text-right">{r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}</td>
                <td className="px-1.5 text-right font-semibold">{r.points}</td>
                <td className="whitespace-nowrap py-1 pl-2 pr-4">
                  <FormChips form={formOf(r.team)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-4 py-2 text-xs text-muted">
        Top {playoffPlaces} reach the knockouts (below the dashed line).
      </p>
    </section>
  );
}
