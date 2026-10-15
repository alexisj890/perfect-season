// A rating in a coloured pill, FotMob-style: blue 9+, green 7–8.9, amber 6–6.9,
// red below 6. The fills are dark enough for white text (at least 5:1), and
// the number is always shown, so the colour is never the only signal.

export function ratingColour(rating: number): string {
  if (rating >= 9) return "bg-blue-700 text-white";
  if (rating >= 8) return "bg-emerald-800 text-white";
  if (rating >= 7) return "bg-emerald-700 text-white";
  if (rating >= 6) return "bg-amber-700 text-white";
  return "bg-red-700 text-white";
}

export function RatingBadge({ rating, className = "" }: { rating: number; className?: string }) {
  return (
    <span className={`inline-flex min-w-8 justify-center rounded-md px-1 text-xs font-bold tabular-nums ${ratingColour(rating)} ${className}`}>
      {rating.toFixed(1)}
    </span>
  );
}
