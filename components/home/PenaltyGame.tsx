"use client";

// The landing page mini-game: drag back from the ball and let go to shoot.
// The rules live in lib/minigame/penalty.ts; this file draws them and handles the mouse.

import { useEffect, useRef, useState, type Dispatch, type PointerEvent } from "react";
import { aimFromDrag, PITCH, randomSpot, SHOT, type Outcome, type Point } from "@/lib/minigame/penalty";
import type { Practice, PracticeAction } from "@/lib/minigame/practice";

const RESULT_TEXT: Record<Outcome, string> = {
  goal: "GOAL!",
  saved: "SAVED!",
  post: "OFF THE POST!",
  wide: "WIDE!",
  over: "OVER THE BAR!",
  short: "TOO SOFT!",
};

interface Props {
  game: Practice;
  dispatch: Dispatch<PracticeAction>;
}

// The score lives with the caller (see PenaltyPractice), so it survives this
// component being closed and reopened.
export function PenaltyGame({ game, dispatch }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Point | null>(null);

  // The game clock: one tick per animation frame, only while the game is on screen.
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05); // cap, so a hidden tab doesn't jump
      last = now;
      dispatch({ type: "tick", dt, nextSpot: randomSpot(Math.random) });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [dispatch]);

  function toPitch(event: PointerEvent): Point {
    const svg = svgRef.current!;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x, y: p.y };
  }

  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    const p = toPitch(event);
    const { ball, phase } = game.round;
    if (phase !== "aiming" || Math.hypot(p.x - ball.x, p.y - ball.y) > 8) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag(p);
  }

  function onPointerUp(event: PointerEvent<SVGSVGElement>) {
    if (!drag) return;
    dispatch({ type: "shoot", pointer: toPitch(event), keeperGuessError: (Math.random() - 0.5) * 6 });
    setDrag(null);
  }

  const { round } = game;
  const aim = drag && round.phase === "aiming" ? aimFromDrag(round.ball, drag) : null;
  const aimColour = !aim ? "" : aim.power > SHOT.overTheBarPower ? "#ff5d5d" : aim.power > 0.6 ? "#f5c518" : "#7ee2a8";

  return (
    <section className="flex flex-col gap-3" aria-label="Penalty mini-game">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${PITCH.width} ${PITCH.height}`}
        className="w-full touch-none select-none overflow-hidden rounded-xl border border-border"
        onPointerDown={onPointerDown}
        onPointerMove={(e) => drag && setDrag(toPitch(e))}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
        role="img"
        aria-label="Drag back from the ball and let go to shoot at goal"
      >
        <Pitch />

        {/* Goalkeeper */}
        <g transform={`translate(${round.keeperX} ${PITCH.keeperY})`}>
          <rect x={-PITCH.keeperHalfWidth} y={-1.1} width={PITCH.keeperHalfWidth * 2} height={2.2} rx={1.1} fill="#ff8a3d" />
          <circle r={1.3} fill="#2a1a10" />
        </g>

        {/* Aim arrow */}
        {aim && (
          <line
            x1={round.ball.x}
            y1={round.ball.y}
            x2={round.ball.x + aim.direction.x * (6 + aim.power * 16)}
            y2={round.ball.y + aim.direction.y * (6 + aim.power * 16)}
            stroke={aimColour}
            strokeWidth={0.7}
            strokeLinecap="round"
            strokeDasharray="1.5 1"
          />
        )}

        {/* Ball (with a soft shadow); it spins as it travels */}
        <ellipse cx={round.ball.x + 0.4} cy={round.ball.y + 0.9} rx={1.4} ry={0.7} fill="black" opacity={0.25} />
        <Ball
          x={round.ball.x}
          y={round.ball.y}
          spin={(round.ball.x + round.ball.y) * 25}
          className={round.phase === "aiming" ? "cursor-grab" : ""}
        />

        {/* Power meter: the red zone at the end sends the ball over the bar */}
        {aim && <PowerMeter power={aim.power} colour={aimColour} />}

        {round.outcome && (
          <text
            x={50}
            y={34}
            textAnchor="middle"
            className={round.outcome === "goal" ? "fill-accent" : "fill-white"}
            style={{ fontSize: 7, fontWeight: 800, paintOrder: "stroke", stroke: "rgba(0,0,0,0.45)", strokeWidth: 1 }}
          >
            {RESULT_TEXT[round.outcome]}
          </text>
        )}
      </svg>

      <p className="text-xs text-muted">
        Drag back from the ball and let go to shoot. Pull further for more power, but too far and it flies over the bar.
      </p>
    </section>
  );
}

// A classic black-and-white football: a black pentagon in the middle and five
// more around the edge (clipped to the ball), joined by seams. Drawn on a unit
// circle, then scaled to the ball's size.
const PENTAGON = Array.from({ length: 5 }, (_, i) => {
  const a = ((-90 + i * 72) * Math.PI) / 180;
  return [Math.cos(a), Math.sin(a)] as const;
});
const pentagonPath = (cx: number, cy: number, r: number, turn = 0) =>
  PENTAGON.map(([x, y], i) => {
    const px = cx + r * (x * Math.cos(turn) - y * Math.sin(turn));
    const py = cy + r * (x * Math.sin(turn) + y * Math.cos(turn));
    return `${i === 0 ? "M" : "L"} ${px.toFixed(3)} ${py.toFixed(3)}`;
  }).join(" ") + " Z";
const EDGE_PATCHES = Array.from({ length: 5 }, (_, i) => {
  const a = ((-54 + i * 72) * Math.PI) / 180;
  return pentagonPath(Math.cos(a) * 1.02, Math.sin(a) * 1.02, 0.4, a + Math.PI / 2);
});

function Ball({ x, y, spin, className }: { x: number; y: number; spin: number; className: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${PITCH.ballRadius}) rotate(${spin})`} className={className}>
      <defs>
        <clipPath id="ball-clip">
          <circle r={1} />
        </clipPath>
      </defs>
      <circle r={1} fill="white" />
      <g clipPath="url(#ball-clip)" fill="#141414">
        <path d={pentagonPath(0, 0, 0.36)} />
        {EDGE_PATCHES.map((d, i) => (
          <path key={i} d={d} />
        ))}
        {/* Seams from the middle pentagon out to the edge patches */}
        {PENTAGON.map(([px, py], i) => (
          <line key={i} x1={px * 0.36} y1={py * 0.36} x2={px * 0.62} y2={py * 0.62} stroke="#141414" strokeWidth={0.07} />
        ))}
      </g>
      <circle r={1} fill="none" stroke="#141414" strokeWidth={0.12} />
    </g>
  );
}

// Big, high-contrast power bar shown while aiming. The red OVER zone shows
// where the shot starts flying over the bar.
function PowerMeter({ power, colour }: { power: number; colour: string }) {
  const width = 34;
  const height = 3.6;
  const overAt = width * SHOT.overTheBarPower;
  return (
    <g transform={`translate(3 ${PITCH.height - height - 3})`}>
      <text y={-1.2} style={{ fontSize: 2.4, fontWeight: 700 }} fill="white">
        POWER
      </text>
      <text x={overAt + (width - overAt) / 2} y={-1.2} textAnchor="middle" style={{ fontSize: 2.2, fontWeight: 800 }} fill="#ff5d5d">
        OVER
      </text>
      <rect width={width} height={height} rx={1.2} fill="black" opacity={0.55} />
      <rect x={overAt} width={width - overAt} height={height} fill="#ff5d5d" opacity={0.75} />
      <rect width={width * power} height={height} rx={1.2} fill={colour} />
      <rect x={overAt - 0.35} y={-0.8} width={0.7} height={height + 1.6} fill="white" />
      <rect width={width} height={height} rx={1.2} fill="none" stroke="white" strokeWidth={0.3} opacity={0.8} />
    </g>
  );
}

// The goal end of the pitch: grass stripes, box markings and the goal.
function Pitch() {
  const line = { fill: "none", strokeWidth: 0.35 } as const;
  return (
    <g>
      <rect width={PITCH.width} height={PITCH.height} className="fill-pitch" />
      {[0, 2, 4, 6].map((i) => (
        <rect key={i} y={i * 8 + 12} width={PITCH.width} height={8} fill="white" opacity={0.04} />
      ))}
      <g className="stroke-pitch-line" {...line}>
        <line x1={0} y1={PITCH.goalLineY} x2={PITCH.width} y2={PITCH.goalLineY} />
        <rect x={14} y={PITCH.goalLineY} width={72} height={34} />
        <rect x={28} y={PITCH.goalLineY} width={44} height={10} />
        <path d="M 39 46 A 14 14 0 0 0 61 46" />
      </g>
      <circle cx={PITCH.penaltySpot.x} cy={PITCH.penaltySpot.y} r={0.5} className="fill-pitch-line" />

      {/* Goal: net, then posts and crossbar */}
      <defs>
        <pattern id="net" width={1.6} height={1.6} patternUnits="userSpaceOnUse">
          <path d="M 0 0 L 1.6 1.6 M 1.6 0 L 0 1.6" stroke="white" strokeWidth={0.12} opacity={0.6} />
        </pattern>
      </defs>
      <rect x={PITCH.goalLeft} y={5} width={PITCH.goalRight - PITCH.goalLeft} height={PITCH.goalLineY - 5} fill="url(#net)" />
      <rect x={PITCH.goalLeft} y={5} width={PITCH.goalRight - PITCH.goalLeft} height={PITCH.goalLineY - 5} fill="black" opacity={0.15} />
      <path
        d={`M ${PITCH.goalLeft} ${PITCH.goalLineY} V 5 H ${PITCH.goalRight} V ${PITCH.goalLineY}`}
        fill="none"
        stroke="white"
        strokeWidth={0.9}
        strokeLinejoin="round"
      />
    </g>
  );
}
