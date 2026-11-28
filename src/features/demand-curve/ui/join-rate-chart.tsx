import type { CSSProperties } from "react";
import type { DemandCurveData } from "@/features/demand-curve";

const W = 360;
const H = 230;
const PAD = { left: 40, right: 24, top: 22, bottom: 34 };

/** Draw-in order for the chart animations in globals.css. */
const order = (i: number) => ({ "--i": i }) as CSSProperties;

/** Join rate per price: line with a likely-range bar at each price. Plain SVG. */
export function JoinRateChart({ chart }: { chart: DemandCurveData["lineChart"] }) {
  const { points, ticks, yMax } = chart;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + plotH * (1 - v / yMax);
  const cx = (i: number) => PAD.left + (plotW / points.length) * (i + 0.5);
  const summary = points.map((p) => `${p.label} ${p.text}`).join(", ");
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${cx(i)},${y(p.rate)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Share who joined the waitlist at each price: ${summary}. Bars show the likely range.`}
      className="h-auto w-full"
    >
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
          <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted-foreground)">
            {Math.round(t * 100)}%
          </text>
        </g>
      ))}
      {points.map((p, i) => (
        <line
          key={`r-${p.key}`}
          x1={cx(i)}
          x2={cx(i)}
          y1={y(Math.min(p.high, yMax * 1.12))}
          y2={y(p.low)}
          className="chart-range"
          style={order(i)}
          stroke="var(--muted-foreground)"
          strokeOpacity={0.45}
          strokeWidth={3}
          strokeLinecap="round"
        />
      ))}
      <path d={path} pathLength={1} className="chart-line" fill="none" stroke="var(--foreground)" strokeWidth={2} strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={p.key}>
          <circle className="chart-point" style={order(i)} cx={cx(i)} cy={y(p.rate)} r={5} fill={p.isBest ? "var(--accent)" : "var(--foreground)"} />
          <text
            className="chart-label"
            style={order(i)}
            x={cx(i) + 9}
            y={y(p.rate) - 8}
            fontSize={13}
            fontWeight={600}
            fill="var(--foreground)"
            stroke="var(--background)"
            strokeWidth={3}
            paintOrder="stroke"
          >
            {p.text}
          </text>
          <text x={cx(i)} y={H - 10} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--foreground)">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
