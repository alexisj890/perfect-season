// The left-hand column of the landing page: the title and what the game is.

export function Hero() {
  return (
    <div className="flex flex-col justify-center gap-4">
      <h1 className="text-6xl font-extrabold tracking-tight">
        Perfect <span className="text-accent">Season</span>
      </h1>
      <p className="max-w-md text-lg text-muted">
        Draft an all-time XI from football&apos;s greatest clubs. Then try to do what no team ever has: win every single
        match.
      </p>
    </div>
  );
}
