// The left-hand column of the landing page: what the game is and how a run works.

const STEPS = [
  {
    title: "Draft",
    text: "Sixteen managers share one pool of 176 all-time greats from 16 legendary clubs. Snake draft, 11 rounds, one player per position in a 4-3-3. Fit and chemistry matter.",
  },
  {
    title: "League",
    text: "Thirty matchdays, home and away against every rival. Three points for a win. The top eight reach the knockouts.",
  },
  {
    title: "Knockouts",
    text: "Two-legged quarter-finals and semi-finals, then a one-off final at a neutral venue. Extra time and penalties if needed.",
  },
];

export function HowItWorks() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-5xl font-extrabold tracking-tight">
          Perfect <span className="text-accent">Season</span>
        </h1>
        <p className="mt-3 max-w-md text-lg text-muted">
          Draft an all-time XI from football&apos;s greatest clubs. Then try to do what no team ever has: win every
          single match.
        </p>
      </div>

      <ol className="flex flex-col gap-5">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pitch font-bold text-white">
              {i + 1}
            </span>
            <div>
              <div className="font-semibold">{step.title}</div>
              <p className="text-sm text-muted">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="rounded-lg border border-border bg-surface-2 p-4 text-sm">
        <span className="font-semibold">35–0</span>
        <span className="text-muted"> = 30 league wins + 2 quarter-final legs + 2 semi-final legs + the final. </span>
        <span className="text-muted">Go through a tie and both legs count as wins.</span>
      </div>
    </div>
  );
}
