// The 35 dots of a perfect-season attempt (the same row as the landing page),
// coloured by what happened: gold win, red dropped, outline still to play.

import type { TrackMark } from "@/lib/playoffs/outcome";

const DOT: Record<TrackMark, string> = {
  win: "bg-accent",
  dropped: "bg-red-500",
  upcoming: "border border-border",
  void: "bg-border/40",
};

const WORD: Record<TrackMark, string> = { win: "won", dropped: "dropped", upcoming: "to play", void: "not reached" };

export function PerfectTracker({ marks }: { marks: TrackMark[] }) {
  const label = `Perfect season: ${marks.filter((m) => m === "win").length} of ${marks.length} won`;
  return (
    <div className="flex gap-1" role="img" aria-label={label}>
      {marks.map((mark, i) => (
        <span
          key={i}
          title={`${i < 30 ? `League match ${i + 1}` : ["QF leg 1", "QF leg 2", "SF leg 1", "SF leg 2", "Final"][i - 30]}: ${WORD[mark]}`}
          className={`h-2 w-2 rounded-full ${DOT[mark]} ${i === 30 ? "ml-1.5" : ""}`}
        />
      ))}
    </div>
  );
}
