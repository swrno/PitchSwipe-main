import { Heart, X } from "lucide-react";
import { INDUSTRIES, TEST_VARIABLES, TEST_VARIABLE_LABELS } from "@/lib/lists";
import { cn } from "@/lib/utils";

/** One marquee row. The items render twice (the second copy hidden from screen readers) for a seamless loop. */
function Row({
  items,
  reverse = false,
  duration,
  label,
  renderItem,
}: {
  items: readonly string[];
  reverse?: boolean;
  duration: string;
  label: string;
  renderItem: (item: string, i: number) => React.ReactNode;
}) {
  return (
    <div className="marquee" data-reverse={reverse ? "" : undefined} style={{ "--marquee-duration": duration } as React.CSSProperties}>
      <ul aria-label={label} className="marquee-track gap-3 py-1.5">
        {items.map((item, i) => (
          <li key={`a-${item}`}>{renderItem(item, i)}</li>
        ))}
        {items.map((item, i) => (
          <li key={`b-${item}`} aria-hidden>
            {renderItem(item, i)}
          </li>
        ))}
      </ul>
    </div>
  );
}

const TONES = ["bg-lime", "bg-sun", "bg-lilac", "bg-coral", "bg-sky"];

/**
 * Two rows moving in opposite directions: the seven things a founder can test, and the idea categories swipers
 * pick from. Both come from the app's own lists (src/lib/lists.ts), so they stay true as the product changes.
 */
export function MarqueeBand() {
  const tests = TEST_VARIABLES.map((v) => (v === "reward" ? "Launch reward" : TEST_VARIABLE_LABELS[v]));
  return (
    <section aria-label="What you can test, and the ideas people swipe on" className="space-y-3 border-y border-border py-6 md:py-8" data-reveal>
      <Row
        items={tests}
        duration="38s"
        label="Things a founder can test"
        renderItem={(item, i) => (
          <span
            className={cn(
              "flex items-center gap-3 whitespace-nowrap rounded-full px-6 py-3 font-display text-xl font-bold text-ink md:text-3xl",
              TONES[i % TONES.length],
            )}
          >
            Test the {item.replace(/^\w/, (c) => c.toLowerCase())}
            <Heart aria-hidden className="size-5 fill-current md:size-6" />
          </span>
        )}
      />
      <Row
        items={INDUSTRIES}
        reverse
        duration="52s"
        label="Idea categories"
        renderItem={(item, i) => (
          <span className="flex items-center gap-2 whitespace-nowrap rounded-full border-2 border-border px-5 py-2 text-base font-semibold text-muted-foreground md:text-lg">
            {i % 2 ? <X aria-hidden className="size-4" strokeWidth={2.5} /> : <Heart aria-hidden className="size-4" />}
            {item}
          </span>
        )}
      />
    </section>
  );
}
