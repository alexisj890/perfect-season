"use client";

// The available players: search, position and club filters, best rated first.

import { useState } from "react";
import type { Player } from "@/lib/data/types";
import { displayRating, filterPool, type PoolFilter, type PositionGroup } from "./draftView";

const GROUPS: (PositionGroup | "ALL")[] = ["ALL", "GK", "DEF", "MID", "FWD"];

interface Props {
  players: Player[];
  clubs: string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function PlayerPool({ players, clubs, selectedId, onSelect }: Props) {
  const [filter, setFilter] = useState<PoolFilter>({ search: "", group: "ALL", club: "ALL" });
  const shown = filterPool(players, filter);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex gap-2">
        <input
          value={filter.search}
          onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          placeholder="Search players or clubs"
          aria-label="Search players or clubs"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <select
          value={filter.club}
          onChange={(e) => setFilter({ ...filter, club: e.target.value })}
          aria-label="Club"
          className="rounded-md border border-border bg-background px-2 py-2 text-sm"
        >
          <option value="ALL">All clubs</option>
          {clubs.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-1.5" role="group" aria-label="Position">
        {GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            aria-pressed={filter.group === g}
            onClick={() => setFilter({ ...filter, group: g })}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              filter.group === g ? "border-accent bg-accent text-accent-foreground" : "border-border text-muted hover:text-foreground"
            }`}
          >
            {g === "ALL" ? "All" : g}
          </button>
        ))}
        <span className="ml-auto self-center text-xs tabular-nums text-muted">{shown.length} available</span>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border" aria-label="Available players">
        {shown.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onSelect(p.id)}
              aria-pressed={selectedId === p.id}
              className={`flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left last:border-b-0 ${
                selectedId === p.id ? "bg-surface-2" : "hover:bg-surface-2/60"
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="block truncate text-xs text-muted">
                  {p.club} · {p.naturalPositions.join("/")}
                </span>
              </span>
              <span className="text-lg font-semibold tabular-nums">{displayRating(p.weightedScore)}</span>
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">No players match.</li>}
      </ul>
    </div>
  );
}
