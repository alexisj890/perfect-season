// Shown after Start, inside the new-run pop-up: the user's random draft
// position and pick numbers.

interface Props {
  teamName: string;
  position: number; // 1–16
  teamCount: number;
  picks: number[];
  onEnter: () => void;
}

export function DraftReveal({ teamName, position, teamCount, picks, onEnter }: Props) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <p className="text-2xl font-bold">
        {teamName} pick <span className="text-accent">{ordinal(position)}</span> of {teamCount}
      </p>
      <p className="text-sm text-muted">It&apos;s a snake draft, so the order reverses every round. Your picks:</p>
      <ol className="flex flex-wrap justify-center gap-2" aria-label="Your pick numbers">
        {picks.map((n, i) => (
          <li key={n} className="flex flex-col items-center rounded-md bg-surface-2 px-2.5 py-1 text-xs">
            <span className="text-muted">R{i + 1}</span>
            <span className="font-semibold">#{n}</span>
          </li>
        ))}
      </ol>
      <button onClick={onEnter} className="rounded-full bg-accent px-6 py-2.5 font-semibold text-accent-foreground hover:brightness-110">
        Enter the draft room
      </button>
    </div>
  );
}

function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
}
