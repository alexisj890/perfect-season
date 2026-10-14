// The user's most recent result, laid out like SofaScore: each goal sits on its
// team's side of a timeline with the running score in the middle, then
// side-by-side stats with split bars (the user's share in gold).

import type { Ref } from "react";
import type { Player } from "@/lib/data/types";
import { formatClock, goalsOf, matchStats, type MatchResult, type ShotEvent, type Side } from "@/lib/engine/match";
import { FORM_STYLE, type FormLetter } from "./seasonView";

interface Props {
  matchday: number;
  homeName: string;
  awayName: string;
  userSide: Side;
  result: MatchResult;
  outcome: FormLetter;
  playersById: Map<string, Player>;
  onOpenRatings: () => void;
  ratingsButtonRef?: Ref<HTMLButtonElement>;
}

type TimelineRow =
  | { kind: "goal"; goal: ShotEvent; home: number; away: number }
  | { kind: "marker"; label: string; home: number; away: number };

// Goals in order with the running score, plus HT / FT (and extra time) markers.
export function timeline(result: MatchResult): TimelineRow[] {
  const rows: TimelineRow[] = [];
  let home = 0;
  let away = 0;
  let halfTimeShown = false;
  let fullTimeShown = false;
  for (const goal of goalsOf(result)) {
    if (!halfTimeShown && goal.minute > 45) {
      rows.push({ kind: "marker", label: "HT", home, away });
      halfTimeShown = true;
    }
    if (result.extraTime && !fullTimeShown && goal.minute > 90) {
      rows.push({ kind: "marker", label: "90'", home, away });
      fullTimeShown = true;
    }
    if (goal.side === "home") home++;
    else away++;
    rows.push({ kind: "goal", goal, home, away });
  }
  if (!halfTimeShown) rows.push({ kind: "marker", label: "HT", home, away });
  rows.push({ kind: "marker", label: result.extraTime ? "AET" : "FT", home, away });
  return rows;
}

export function LastResultCard(props: Props) {
  const { matchday, homeName, awayName, userSide, result, outcome, playersById, onOpenRatings, ratingsButtonRef } = props;
  const name = (id: string) => playersById.get(id)?.name ?? id;
  const stats = matchStats(result);
  const statRows: [string, keyof typeof stats.home][] = [
    ["Shots", "shots"],
    ["On target", "shotsOnTarget"],
    ["Corners", "corners"],
    ["Woodwork", "woodwork"],
  ];
  const teamClass = (side: Side) => (side === userSide ? "text-accent" : "");

  return (
    // Clicking anywhere on the card opens the player ratings; the button in the
    // header does the same for keyboard users.
    <section
      onClick={onOpenRatings}
      className="flex cursor-pointer flex-col gap-4 rounded-xl border border-border bg-surface p-5 hover:border-accent/60"
      aria-label="Last result"
    >
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted">
        <span>Last result · Matchday {matchday}</span>
        <span className="flex items-center gap-2">
          <button
            ref={ratingsButtonRef}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpenRatings();
            }}
            className="rounded-full border border-border px-2 py-0.5 text-[11px] normal-case tracking-normal text-muted hover:border-accent hover:text-foreground"
          >
            Player ratings ›
          </button>
          <span className={`rounded px-1.5 py-0.5 text-[11px] ${FORM_STYLE[outcome]}`}>{outcome}</span>
        </span>
      </div>

      {/* Scoreboard */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
        <span className={`text-sm font-semibold leading-tight ${teamClass("home")}`}>{homeName}</span>
        <span className="font-display text-4xl font-extrabold tabular-nums">
          {result.homeGoals}
          <span className="mx-1 text-muted">–</span>
          {result.awayGoals}
        </span>
        <span className={`text-sm font-semibold leading-tight ${teamClass("away")}`}>{awayName}</span>
      </div>

      {/* Goal timeline: home goals on the left, away goals on the right */}
      <ol className="flex flex-col text-sm" aria-label="Goals">
        {timeline(result).map((row, i) =>
          row.kind === "marker" ? (
            <li key={i} className="my-1 flex items-center gap-2 text-[11px] font-semibold text-muted">
              <span className="h-px flex-1 bg-border" />
              <span className="tabular-nums">
                {row.label} {row.home}–{row.away}
              </span>
              <span className="h-px flex-1 bg-border" />
            </li>
          ) : (
            <li key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1" aria-label={goalLabel(row.goal, name, homeName, awayName)}>
              <GoalCell goal={row.goal.side === "home" ? row.goal : null} align="right" name={name} />
              <span className="rounded bg-surface-2 px-1.5 text-xs font-semibold tabular-nums">
                <span className={row.goal.side === "home" ? "text-foreground" : "text-muted"}>{row.home}</span>
                <span className="text-muted">–</span>
                <span className={row.goal.side === "away" ? "text-foreground" : "text-muted"}>{row.away}</span>
              </span>
              <GoalCell goal={row.goal.side === "away" ? row.goal : null} align="left" name={name} />
            </li>
          ),
        )}
        {result.shootout && (
          <li className="mt-1 text-center text-xs font-semibold tabular-nums text-muted">
            Penalties {result.shootout.home}–{result.shootout.away}
          </li>
        )}
      </ol>

      {/* Stats with split bars */}
      <dl className="flex flex-col gap-2 text-xs tabular-nums">
        {statRows.map(([label, key]) => {
          const h = stats.home[key];
          const a = stats.away[key];
          const homeShare = h + a === 0 ? 50 : (h / (h + a)) * 100;
          return (
            <div key={key} className="flex flex-col gap-1">
              <div className="flex justify-between">
                <dd className={`font-semibold ${teamClass("home")}`}>{h}</dd>
                <dt className="text-muted">{label}</dt>
                <dd className={`font-semibold ${teamClass("away")}`}>{a}</dd>
              </div>
              <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
                <span className={userSide === "home" ? "bg-accent" : "bg-muted/50"} style={{ width: `${homeShare}%` }} />
                <span className={userSide === "away" ? "bg-accent" : "bg-muted/50"} style={{ width: `${100 - homeShare}%` }} />
              </div>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

function GoalCell({ goal, align, name }: { goal: ShotEvent | null; align: "left" | "right"; name: (id: string) => string }) {
  if (!goal) return <span />;
  const note = goal.source === "penalty" ? "pen" : goal.source === "free kick" ? "free kick" : null;
  return (
    <span className={`flex min-w-0 flex-col ${align === "right" ? "items-end text-right" : "items-start text-left"}`}>
      <span className={`flex max-w-full items-baseline gap-1.5 ${align === "right" ? "flex-row-reverse" : ""}`}>
        <span className="shrink-0 text-xs tabular-nums text-muted">{formatClock(goal)}</span>
        <span className="truncate font-medium">{name(goal.shooterId)}</span>
      </span>
      {(goal.assistId || note) && (
        <span className="max-w-full truncate text-xs text-muted">
          {goal.assistId ? `Assist: ${name(goal.assistId)}` : note}
        </span>
      )}
    </span>
  );
}

function goalLabel(goal: ShotEvent, name: (id: string) => string, homeName: string, awayName: string): string {
  const team = goal.side === "home" ? homeName : awayName;
  const assist = goal.assistId ? `, assist ${name(goal.assistId)}` : "";
  return `${formatClock(goal)} goal for ${team}: ${name(goal.shooterId)}${assist}`;
}
