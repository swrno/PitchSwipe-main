import type { Metadata } from "next";
import { SwipeExperience } from "@/components/swipe/swipe-experience";

export const metadata: Metadata = { title: "Swipe" };

/**
 * Swipe feed (S5 home, S6 cards): designs phone 33/34/35/39/40, web 32/33.
 * Live decks come in random order, each deck once; Flagsmith picks the card (src/lib/swipe).
 */
export default function SwipePage() {
  return <SwipeExperience mode="feed" />;
}
