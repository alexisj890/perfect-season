// The landing page hero: a huge "35–0", a row of 35 dots that fill in one by
// one, and the tagline. Server-rendered, so it shows before any JavaScript loads.

export const PERFECT_MATCHES = 35;
const DOT_DELAY_MS = 35;

export function LandingHero() {
  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="font-display text-[200px] font-extrabold leading-[0.85] tracking-tight tabular-nums">
        35–0
      </h1>
      <div className="flex gap-1.5" role="img" aria-label="35 matches, 35 wins">
        {Array.from({ length: PERFECT_MATCHES }, (_, i) => (
          <span key={i} className="perfect-dot h-2 w-2 rounded-full" style={{ animationDelay: `${i * DOT_DELAY_MS}ms` }} />
        ))}
      </div>
      <p className="max-w-lg text-lg text-muted">
        Draft an all-time XI from football&apos;s greatest clubs. Then win every single match.
      </p>
    </div>
  );
}
