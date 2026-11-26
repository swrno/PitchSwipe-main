import type * as React from "react";
import { cn } from "@/lib/utils";

/** Circular 0-100 score, green when swipes count, orange when not yet (designs 31, 32). */
export function ScoreRing({
  score,
  counting,
  size = 160,
  className,
}: {
  score: number;
  counting: boolean;
  size?: number;
  className?: string;
}) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, score)) / 100) * c;
  return (
    <div
      className={cn("relative grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Quality score ${score} of 100`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-secondary" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          // Fills from empty to the real score once, on mount (globals.css: score-ring-fill).
          style={{ "--ring-c": c } as React.CSSProperties}
          className={cn("score-ring-fill", counting ? "stroke-accent" : "stroke-warning")}
        />
      </svg>
      <div className="absolute text-center">
        <div className="stretch-display tnum text-5xl font-extrabold leading-none tracking-tight">{score}</div>
        <div className="mt-1 text-sm text-muted-foreground">of 100</div>
      </div>
    </div>
  );
}
