// A cup with two handles, drawn in the current text colour. Solid for a
// champion; an outline for runs that fell short.

export function Trophy({ won, className = "" }: { won: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 64 80" className={className} aria-hidden="true">
      <g
        fill={won ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={won ? 0 : 2}
        strokeLinejoin="round"
        opacity={won ? 1 : 0.45}
      >
        {/* Bowl */}
        <path d="M14 6h36v14c0 12-8 22-18 22S14 32 14 20z" />
        {/* Stem and base */}
        <path d="M28 41h8v12h-8z" />
        <path d="M20 58c0-3 3-5 6-5h12c3 0 6 2 6 5v3H20z" />
        <rect x={16} y={62} width={32} height={10} rx={2} />
      </g>
      {/* Handles */}
      <g fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" opacity={won ? 1 : 0.45}>
        <path d="M14 11H8c0 10 4 16 9 18" />
        <path d="M50 11h6c0 10-4 16-9 18" />
      </g>
      {won && <path d="M22 11c0 9 2 15 6 20" fill="none" stroke="white" strokeOpacity={0.35} strokeWidth={2.5} strokeLinecap="round" />}
    </svg>
  );
}
