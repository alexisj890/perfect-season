"use client";

// Right-hand panel: results of any played matchday, or the top scorers.

import { useState } from "react";
import type { Player } from "@/lib/data/types";
import type { LeagueMatch, ScorerRow } from "@/lib/season/season";

interface Props {
  latestMatchday: number;
  matchesOn: (matchday: number) => LeagueMatch[];
  scorers: ScorerRow[];
  names: string[];
  user: number;
  playersById: Map<string, Player>;
}

export function SidePanel({ latestMatchday, matchesOn, scorers, names, user, playersById }: Props) {
  const [tab, setTab] = useState<"results" | "scorers">("results");
  // null = follow the latest matchday as the season moves on.
  const [picked, setPicked] = useState<number | null>(null);
  const day = picked ?? latestMatchday;

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3 rounded-xl border border-border bg-surface p-4" aria-label="Results and scorers">
      <div className="flex rounded-full border border-border p-0.5" role="tablist">
        {(["results", "scorers"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full px-3 py-1 text-xs font-semibold ${tab === t ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"}`}
          >
            {t === "results" ? "Results" : "Top scorers"}
          </button>
        ))}
      </div>

      {tab === "results" ? (
        latestMatchday === 0 ? (
          <p className="text-sm text-muted">No matches played yet.</p>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                aria-label="Previous matchday"
                disabled={day <= 1}
                onClick={() => setPicked(day - 1)}
                className="rounded px-2 text-muted hover:text-foreground disabled:opacity-30"
              >
                ‹
              </button>
              <span className="font-semibold tabular-nums">Matchday {day}</span>
              <button
                type="button"
                aria-label="Next matchday"
                disabled={day >= latestMatchday}
                onClick={() => setPicked(day + 1 >= latestMatchday ? null : day + 1)}
                className="rounded px-2 text-muted hover:text-foreground disabled:opacity-30"
              >
                ›
              </button>
            </div>
            <ul className="flex min-h-0 flex-col overflow-y-auto text-sm tabular-nums" aria-label={`Matchday ${day} results`}>
              {matchesOn(day).map((m, i) => (
                <li
                  key={i}
                  className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border/50 py-1.5 last:border-b-0 ${
                    m.home === user || m.away === user ? "font-semibold" : ""
                  }`}
                >
                  <span className={`truncate text-right ${m.home === user ? "text-accent" : ""}`}>{names[m.home]}</span>
                  <span className="rounded bg-surface-2 px-1.5">
                    {m.result ? `${m.result.homeGoals}–${m.result.awayGoals}` : "v"}
                  </span>
                  <span className={`truncate ${m.away === user ? "text-accent" : ""}`}>{names[m.away]}</span>
                </li>
              ))}
            </ul>
          </>
        )
      ) : (
        <ol className="flex min-h-0 flex-col overflow-y-auto text-sm tabular-nums" aria-label="Top scorers">
          {scorers.slice(0, 15).map((s, i) => (
            <li key={s.playerId} className="flex items-center gap-2 border-b border-border/50 py-1.5 last:border-b-0">
              <span className="w-5 text-right text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate ${s.team === user ? "font-semibold text-accent" : ""}`}>
                  {playersById.get(s.playerId)?.name}
                </span>
                <span className="block truncate text-xs text-muted">{names[s.team]}</span>
              </span>
              <span className="font-semibold">{s.goals}</span>
            </li>
          ))}
          {scorers.length === 0 && <li className="text-muted">No goals yet.</li>}
        </ol>
      )}
    </section>
  );
}
