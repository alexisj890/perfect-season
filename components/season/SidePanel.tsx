"use client";

// Right-hand panel: results of any played matchday, or the top scorers.

import { useState } from "react";
import { RatingBadge } from "@/components/ratings/RatingBadge";
import type { Player } from "@/lib/data/types";
import type { SeasonPlayerStats } from "@/lib/engine/ratings";
import type { LeagueMatch, ScorerRow } from "@/lib/season/season";

interface Props {
  latestMatchday: number;
  matchesOn: (matchday: number) => LeagueMatch[];
  scorers: ScorerRow[];
  names: string[];
  user: number;
  playersById: Map<string, Player>;
  squad: SeasonPlayerStats[]; // the user's players, best average first
}

type Tab = "results" | "scorers" | "squad";
const TAB_LABEL: Record<Tab, string> = { results: "Results", scorers: "Scorers", squad: "Squad" };

export function SidePanel({ latestMatchday, matchesOn, scorers, names, user, playersById, squad }: Props) {
  const [tab, setTab] = useState<Tab>("results");
  // null = follow the latest matchday as the season moves on.
  const [picked, setPicked] = useState<number | null>(null);
  const day = picked ?? latestMatchday;

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3 rounded-xl border border-border bg-surface p-4" aria-label="Results and scorers">
      <div className="flex rounded-full border border-border p-0.5" role="tablist">
        {(["results", "scorers", "squad"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full px-3 py-1 text-xs font-semibold ${tab === t ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"}`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === "squad" ? (
        <SquadList squad={squad} playersById={playersById} />
      ) : tab === "results" ? (
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

// The user's players over the season: average rating, goals, assists and Man of the Match awards.
export function SquadList({ squad, playersById }: { squad: SeasonPlayerStats[]; playersById: Map<string, Player> }) {
  const apps = squad[0]?.apps ?? 0;
  if (apps === 0) return <p className="text-sm text-muted">Ratings appear after your first match.</p>;
  return (
    <div className="flex min-h-0 flex-col gap-1">
      <div className="grid grid-cols-[2.5rem_1fr_1.5rem_1.5rem_1.5rem] gap-2 px-1 text-[11px] font-semibold text-muted">
        <span>Avg</span>
        <span>Player · {apps} {apps === 1 ? "match" : "matches"}</span>
        <span className="text-right">G</span>
        <span className="text-right">A</span>
        <span className="text-right" title="Man of the Match awards">★</span>
      </div>
      <ol className="flex min-h-0 flex-col overflow-y-auto text-sm tabular-nums" aria-label="Squad season ratings">
        {squad.map((s) => (
          <li key={s.playerId} className="grid grid-cols-[2.5rem_1fr_1.5rem_1.5rem_1.5rem] items-center gap-2 border-b border-border/50 px-1 py-1 last:border-b-0">
            <RatingBadge rating={s.averageRating} />
            <span className="min-w-0 truncate">
              {playersById.get(s.playerId)?.name} <span className="text-xs text-muted">{s.slot}</span>
            </span>
            <span className="text-right">{s.goals}</span>
            <span className="text-right">{s.assists}</span>
            <span className="text-right text-accent">{s.motm || ""}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
