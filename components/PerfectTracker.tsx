// The 35 dots of the season (the same row as the landing page), one per match.
// Each result has its own shape as well as its colour, so it reads without
// colour vision: a solid gold dot for a win, a hollow ring for a draw, a red ×
// for a defeat, a small dot still to play, and a faint dash for matches never reached.

import type { TrackMark } from "@/lib/playoffs/outcome";

const WORD: Record<TrackMark, string> = { win: "won", draw: "drawn", loss: "lost", upcoming: "to play", void: "not reached" };
const KNOCKOUT = ["QF leg 1", "QF leg 2", "SF leg 1", "SF leg 2", "Final"];

function Mark({ mark }: { mark: TrackMark }) {
  switch (mark) {
    case "win":
      return <span className="h-2.5 w-2.5 rounded-full bg-accent" />;
    case "draw":
      return <span className="h-2.5 w-2.5 rounded-full border-2 border-muted" />;
    case "loss":
      return (
        <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 text-danger" aria-hidden="true">
          <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
        </svg>
      );
    case "upcoming":
      return <span className="h-1 w-1 rounded-full bg-muted" />;
    case "void":
      return <span className="h-0.5 w-1.5 rounded-full bg-muted/50" />;
  }
}

export function PerfectTracker({ marks }: { marks: TrackMark[] }) {
  const count = (m: TrackMark) => marks.filter((x) => x === m).length;
  const label = `Season so far: ${count("win")} won, ${count("draw")} drawn, ${count("loss")} lost, of ${marks.length}`;
  return (
    <div className="flex items-center gap-1" role="img" aria-label={label}>
      {marks.map((mark, i) => (
        <span
          key={i}
          title={`${i < 30 ? `League match ${i + 1}` : KNOCKOUT[i - 30]}: ${WORD[mark]}`}
          className={`flex h-2.5 w-2.5 items-center justify-center ${i === 30 ? "ml-2" : ""}`}
        >
          <Mark mark={mark} />
        </span>
      ))}
    </div>
  );
}
