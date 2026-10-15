// The markings of a vertical pitch drawn 100 wide × 130 tall, used inside an
// <svg viewBox="0 0 100 130"> by the draft pitch and the end screen's XI.

export const VERTICAL_PITCH_HEIGHT = 130;

// Pulls a formation_slots.csv coordinate (0–100) slightly inward, so labels
// under the keeper and wingers aren't clipped at the edges.
export const inset = (n: number, margin: number) => margin + (n * (100 - 2 * margin)) / 100;

export function VerticalPitchMarkings() {
  const h = VERTICAL_PITCH_HEIGHT;
  return (
    <>
      <rect width={100} height={h} className="fill-pitch" />
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} y={i * 13} width={100} height={6.5} fill="white" opacity={0.035} />
      ))}
      <g className="stroke-pitch-line" fill="none" strokeWidth={0.4} opacity={0.7}>
        <rect x={3} y={3} width={94} height={h - 6} />
        <line x1={3} y1={h / 2} x2={97} y2={h / 2} />
        <circle cx={50} cy={h / 2} r={11} />
        <rect x={22} y={3} width={56} height={18} />
        <rect x={22} y={h - 21} width={56} height={18} />
        <rect x={36} y={3} width={28} height={7} />
        <rect x={36} y={h - 10} width={28} height={7} />
      </g>
    </>
  );
}
