// The markings of a horizontal 105 × 68 pitch, drawn in SVG units (metres).
// Used inside an <svg viewBox="0 0 105 68"> by the ratings pitch and the replay.

export function HorizontalPitchMarkings() {
  return (
    <>
      <rect width={105} height={68} className="fill-pitch" />
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={i} x={i * 15} width={7.5} height={68} fill="white" opacity={0.035} />
      ))}
      <g className="stroke-pitch-line" fill="none" strokeWidth={0.35} opacity={0.7}>
        <rect x={0} y={0} width={105} height={68} />
        <line x1={52.5} y1={0} x2={52.5} y2={68} />
        <circle cx={52.5} cy={34} r={9.15} />
        <rect x={0} y={13.85} width={16.5} height={40.3} />
        <rect x={88.5} y={13.85} width={16.5} height={40.3} />
        <rect x={0} y={24.85} width={5.5} height={18.3} />
        <rect x={99.5} y={24.85} width={5.5} height={18.3} />
      </g>
      {/* Goals, just outside each end line */}
      <rect x={-1.6} y={30.34} width={1.6} height={7.32} fill="white" opacity={0.85} />
      <rect x={105} y={30.34} width={1.6} height={7.32} fill="white" opacity={0.85} />
    </>
  );
}
