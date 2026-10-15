// The line beside the 35 dots: which season honour is still possible.
//   Perfect season    — all 35 won
//   Invincible season — all 35 played, none lost (draws allowed)

import { invincibleSeason, perfectSeason } from "@/lib/playoffs/outcome";
import type { PlayoffState } from "@/lib/playoffs/playoffs";
import type { SeasonState } from "@/lib/season/season";

const KNOCKOUT_MATCH = ["the first leg of the quarter-final", "the second leg of the quarter-final", "the first leg of the semi-final", "the second leg of the semi-final", "the final"];

export function HonoursStatus({ season, playoffs, user, matchIndexOfFirstLoss }: {
  season: SeasonState;
  playoffs: PlayoffState | null;
  user: number;
  matchIndexOfFirstLoss: number; // position of the first red dot, or −1
}) {
  const perfect = perfectSeason(season, playoffs, user);
  const invincible = invincibleSeason(season, playoffs, user);

  let text: React.ReactNode;
  if (perfect.perfect) text = <b className="text-accent">Perfect season! 35–0</b>;
  else if (invincible.invincible) text = <b className="text-accent">Invincible season! Unbeaten</b>;
  else if (perfect.alive)
    text = (
      <>
        <b className="text-accent">{perfect.wins}</b> of {perfect.target} won · perfect season alive
      </>
    );
  else if (invincible.alive)
    text = (
      <>
        Perfect season ended · <b className="text-foreground">still unbeaten</b> ({invincible.won}W {invincible.drawn}D)
      </>
    );
  else if (matchIndexOfFirstLoss >= 0)
    text = `Unbeaten run ended ${matchIndexOfFirstLoss < 30 ? `on matchday ${matchIndexOfFirstLoss + 1}` : `in ${KNOCKOUT_MATCH[matchIndexOfFirstLoss - 30]}`}`;
  else text = "Season over";

  return <span className="text-xs tabular-nums text-muted">{text}</span>;
}
