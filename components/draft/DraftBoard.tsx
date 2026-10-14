// Every team's picks, round by round.

import type { Player } from "@/lib/data/types";
import type { DraftState } from "@/lib/draft/draft";
import { surname } from "./draftView";

export function DraftBoard({ draft, playersById }: { draft: DraftState; playersById: Map<string, Player> }) {
  const rounds = Array.from({ length: draft.rounds }, (_, i) => i + 1);
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full table-fixed border-collapse text-xs">
        <colgroup>
          <col className="w-44" />
          {rounds.map((r) => (
            <col key={r} />
          ))}
        </colgroup>
        <thead>
          <tr className="text-muted">
            <th className="sticky left-0 bg-surface px-3 py-2 text-left font-semibold">Team</th>
            {rounds.map((r) => (
              <th key={r} className="px-2 py-2 font-semibold tabular-nums">
                R{r}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {draft.teams.map((team, t) => (
            <tr key={t} className={`border-t border-border ${team.isUser ? "bg-accent/10" : ""}`}>
              <th className={`sticky left-0 bg-surface px-3 py-1.5 text-left font-medium ${team.isUser ? "text-accent" : ""}`}>
                {team.name}
              </th>
              {rounds.map((r) => {
                const pick = draft.picks.find((p) => p.teamIndex === t && p.round === r);
                return (
                  <td key={r} className="truncate px-2 py-1.5 text-center">
                    {pick ? (
                      <span title={playersById.get(pick.playerId)?.name}>
                        {surname(playersById.get(pick.playerId)?.name ?? "")}
                        <span className="ml-1 text-muted">{pick.slot}</span>
                      </span>
                    ) : (
                      <span className="text-border">·</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
