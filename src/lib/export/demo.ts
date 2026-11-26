/**
 * Demo-mode swipe rows (no MONGODB_URI). The fixtures only hold aggregates, so one anonymous
 * row per swipe is generated deterministically from them: per version the swipers and yes
 * counts, per version the feed / link split, and the state and interest group sizes all match
 * the aggregates. The times, the comments and which state each swipe came from are made up for the demo, so every
 * demo export starts with a "Demo data" note (stamp.ts DEMO_NOTE). Never used in real mode (load.ts).
 */
import type { DeckAggregates } from "@/lib/results/aggregate";
import type { CardMeta } from "@/lib/results/leaderboard";

import type { ExportSwipe } from "./types";

const DEMO_COMMENTS = [
  "Getting paid faster is the real pain, not keeping the ledger.",
  "Voice entry sounds handy, but will it understand customer names?",
  "The price is fine, but it is not clear what you get for it.",
  "Reminders on WhatsApp would be good.",
  "I already use a notebook, why switch?",
];

export function demoSwipes(cards: readonly CardMeta[], agg: DeckAggregates, now: Date): ExportSwipe[] {
  const total = cards.reduce((n, c) => n + (agg.byCard.everyone[c.key]?.swipers ?? 0), 0);
  if (total === 0) return [];

  // Exact group sizes: one state per swipe for the shown states, nothing for the rest.
  const states: (string | null)[] = [];
  for (const g of agg.location) if (!g.forceHidden) for (let i = 0; i < g.swipers; i++) states.push(g.key);
  while (states.length < total) states.push(null);

  // Each interest covers a window of consecutive swipes, so its size matches and people can hold several.
  const interests: string[][] = Array.from({ length: total }, () => []);
  let cursor = 0;
  for (const g of agg.interests) {
    for (let i = 0; i < g.swipers; i++) interests[(cursor + i) % total].push(g.label);
    cursor += g.swipers;
  }

  const out: ExportSwipe[] = [];
  let g = 0;
  for (const card of cards) {
    const t = agg.byCard.everyone[card.key];
    if (!t) continue;
    const feed = agg.cardBySource[card.key]?.feed.swipers ?? t.swipers;
    for (let i = 0; i < t.swipers; i++, g++) {
      const minutesAgo = (g * 997) % (5 * 24 * 60);
      out.push({
        at: new Date(now.getTime() - minutesAgo * 60_000),
        cardLabel: card.label,
        answer: i < t.saidYes ? "yes" : "no",
        comment: g % 9 === 0 ? DEMO_COMMENTS[(g / 9) % DEMO_COMMENTS.length | 0] : "",
        region: states[g],
        source: i < feed ? "feed" : "link",
        interests: interests[g],
      });
    }
  }
  return out;
}
