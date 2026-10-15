// The user's knockout matches so far, each with a replay link.

import Link from "next/link";
import type { PlayoffMatch } from "@/lib/playoffs/playoffs";

export function YourPath({ matches, names, user }: { matches: PlayoffMatch[]; names: string[]; user: number }) {
  return (
    <section className="flex min-h-0 flex-col gap-2 rounded-xl border border-border bg-surface p-4" aria-label="Your path">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Your path</h3>
      {matches.length === 0 ? (
        <p className="text-sm text-muted">Your knockout results will appear here.</p>
      ) : (
        <ol className="flex flex-col gap-1.5 text-sm">
          {matches.map((m) => {
            const r = m.result!;
            const home = m.home === user;
            const mine = home ? r.homeGoals : r.awayGoals;
            const theirs = home ? r.awayGoals : r.homeGoals;
            const opponent = names[(home ? m.away : m.home)!];
            const pens = r.shootout ? ` (pens ${home ? r.shootout.home : r.shootout.away}–${home ? r.shootout.away : r.shootout.home})` : r.extraTime ? " (aet)" : "";
            const letter = mine > theirs ? "W" : mine < theirs ? "L" : r.shootout && r.winner === (home ? "home" : "away") ? "W" : "D";
            return (
              <li key={m.key} className="flex items-center gap-2">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold text-white ${
                    letter === "W" ? "bg-emerald-500" : letter === "D" ? "bg-slate-400" : "bg-red-500"
                  }`}
                >
                  {letter}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-muted">{m.label}</span>
                  <span className="block truncate tabular-nums">
                    {mine}–{theirs}
                    {pens} v {opponent}
                  </span>
                </span>
                <Link href={`/match/${m.key}`} className="shrink-0 text-xs text-muted underline-offset-4 hover:text-foreground hover:underline">
                  Replay ›
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
