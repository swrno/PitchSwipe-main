import type { CSSProperties } from "react";
import type { DemandCurveData } from "@/lib/demand-curve";

const W = 360;
const H = 230;
const PAD = { left: 8, right: 8, top: 34, bottom: 48 };

/** Draw-in order for the chart animations in globals.css. */
const order = (i: number) => ({ "--i": i }) as CSSProperties;

/** Revenue per 100 swipers: bars, best price highlighted. Plain SVG. */
export function RevenueChart({ chart }: { chart: DemandCurveData["barChart"] }) {
  const { bars, yMax } = chart;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(1, bars.length);
  const barW = Math.min(52, slot * 0.58);
  const base = PAD.top + plotH;
  const summary = bars.map((b) => `${b.label} ${b.valueText}`).join(", ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Revenue per 100 swipers per month if every sign-up pays: ${summary}.`}
      className="h-auto w-full"
    >
      <line x1={PAD.left} x2={W - PAD.right} y1={base} y2={base} stroke="var(--border)" strokeWidth={1} />
      {bars.map((b, i) => {
        const cx = PAD.left + slot * (i + 0.5);
        const h = yMax === 0 ? 0 : Math.max(2, (b.value / yMax) * plotH);
        return (
          <g key={b.key}>
            <rect
              className="chart-bar"
              style={order(i)}
              x={cx - barW / 2}
              y={base - h}
              width={barW}
              height={h}
              rx={4}
              fill={b.isBest ? "var(--accent)" : "var(--border)"}
            />
            <text className="chart-label" style={order(i)} x={cx} y={base - h - 8} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--foreground)">
              {b.valueText}
            </text>
            <text x={cx} y={base + 17} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--foreground)">
              {b.label}
            </text>
            <text x={cx} y={base + 32} textAnchor="middle" fontSize={9} fill="var(--muted-foreground)">
              {b.subLabel}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
