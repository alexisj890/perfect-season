// The 35 dots of the season (the same row as the landing page), one per match:
// gold win, slate draw, red defeat, outline still to play, faint not reached.

import type { TrackMark } from "@/lib/playoffs/outcome";

const DOT: Record<TrackMark, string> = {
  win: "bg-accent",
  draw: "bg-slate-400",
  loss: "bg-red-500",
  upcoming: "border border-border",
  void: "bg-border/40",
};

const WORD: Record<TrackMark, string> = { win: "won", draw: "drawn", loss: "lost", upcoming: "to play", void: "not reached" };
const KNOCKOUT = ["QF leg 1", "QF leg 2", "SF leg 1", "SF leg 2", "Final"];

export function PerfectTracker({ marks }: { marks: TrackMark[] }) {
  const count = (m: TrackMark) => marks.filter((x) => x === m).length;
  const label = `Season so far: ${count("win")} won, ${count("draw")} drawn, ${count("loss")} lost, of ${marks.length}`;
  return (
    <div className="flex gap-1" role="img" aria-label={label}>
      {marks.map((mark, i) => (
        <span
          key={i}
          title={`${i < 30 ? `League match ${i + 1}` : KNOCKOUT[i - 30]}: ${WORD[mark]}`}
          className={`h-2 w-2 rounded-full ${DOT[mark]} ${i === 30 ? "ml-1.5" : ""}`}
        />
      ))}
    </div>
  );
}
