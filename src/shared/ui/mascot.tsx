import { cn } from "@/shared/lib/utils";

type Mood = "happy" | "wink" | "wow";

/**
 * PitchSwipe's own character: a little pitch card with a face, leaning like it is being swiped. Decorative only
 * (aria-hidden). `color` fills the card; the face is always ink so it reads on any block colour.
 */
export function Mascot({
  color = "var(--cream)",
  back ="var(--accent)",
  mood = "happy",
  tight = false,
  className,
}: {
  color?: string;
  back?: string;
  mood?: Mood;
  /** Crop to the drawing (logo use): no empty margin around the two cards. */
  tight?: boolean;
  className?: string;
}) {
  return (
    <svg viewBox={tight ? "16 8 68 82" : "0 0 96 96"} aria-hidden className={cn("size-20 shrink-0", className)}>
      {/* The card behind, peeking out. */}
      <rect x="24" y="14" width="46" height="62" rx="11" fill={back} stroke="#111" strokeWidth="3" transform="rotate(-12 47 45)" />
      {/* The front card. */}
      <g transform="rotate(8 52 50)">
        <rect x="28" y="18" width="48" height="64" rx="12" fill={color} stroke="#111" strokeWidth="3" />
        {/* Eyes */}
        {mood === "wink" ? (
          <path d="M40 46 q4 -4 8 0" fill="none" stroke="#111" strokeWidth="3" strokeLinecap="round" />
        ) : (
          <circle cx="44" cy="45" r={mood === "wow" ? 4 : 3.2} fill="#111" />
        )}
        <circle cx="60" cy="45" r={mood === "wow" ? 4 : 3.2} fill="#111" />
        {/* Cheeks */}
        <circle cx="38.5" cy="53" r="3.4" fill="var(--accent)" opacity="0.85" />
        <circle cx="65.5" cy="53" r="3.4" fill="var(--accent)" opacity="0.85" />
        {/* Mouth */}
        {mood === "wow" ? (
          <ellipse cx="52" cy="57" rx="4" ry="5" fill="#111" />
        ) : (
          <path d="M45 54 q7 7 14 0" fill="none" stroke="#111" strokeWidth="3" strokeLinecap="round" />
        )}
        {/* A small heart, the yes mark */}
        <path d="M52 74 c-3.2 -2.6 -6 -4.4 -6 -7.2 c0 -1.9 1.4 -3.2 3.1 -3.2 c1.3 0 2.3 0.8 2.9 1.8 c0.6 -1 1.6 -1.8 2.9 -1.8 c1.7 0 3.1 1.3 3.1 3.2 c0 2.8 -2.8 4.6 -6 7.2z" fill="#111" />
      </g>
    </svg>
  );
}

/** The round arrow chip that sits at the end of a pill button. */
export function ArrowChip({ className, tone = "lime" }: { className?: string; tone?: "lime" | "ink" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full",
        tone === "lime" ? "bg-lime text-ink" : "bg-ink text-ink-foreground",
        className,
      )}
    >
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 8h10M9 4l4 4-4 4" />
      </svg>
    </span>
  );
}
