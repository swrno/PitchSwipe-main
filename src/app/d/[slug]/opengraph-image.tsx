import { ImageResponse } from "next/og";
import { composeCard } from "@/features/swipe/card";
import { getSwipeStore } from "@/features/swipe/server/store";

export const alt = "A pitch to answer on PitchSwipe";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
/** Cache the rendered preview for 5 minutes: one DB read and render per slug, not per request. */
export const revalidate = 300;

const ACCENT = { green: "#16803c", blue: "#1f63e0", purple: "#7c3aed" } as const;

/** 1200x630 preview for WhatsApp / LinkedIn unfurls: product, control headline, price and reward. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // A misconfigured production backend renders the generic preview instead of failing.
  const store = await getSwipeStore().catch(() => null);
  const deck = store ? await store.getDeckBySlug(slug).catch(() => null) : null;
  const card = deck && deck.cards[0] ? composeCard(deck, deck.cards[0], { source: "link", paid: false, paidRs: 0, counting: true }) : null;
  const accent = deck ? ACCENT[deck.product.accent] : "#16803c";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f7f7f7",
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: accent,
              color: "#fff",
              fontSize: 40,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {(deck?.product.name ?? "P").slice(0, 1)}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 40, fontWeight: 800, color: "#0b0b0b" }}>{deck?.product.name ?? "PitchSwipe"}</div>
            <div style={{ fontSize: 26, color: "#5c5c5c" }}>{deck?.product.category ?? "Test your pitch"}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, color: "#0b0b0b", letterSpacing: -2 }}>
            {card?.headline ?? "Give your honest take on one idea."}
          </div>
          {card?.description ? <div style={{ fontSize: 30, color: "#5c5c5c" }}>{card.description}</div> : null}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: accent }}>Vote in 10 seconds on PitchSwipe</div>
          {card?.price ? (
            <div style={{ fontSize: 48, fontWeight: 800, color: "#0b0b0b" }}>
              {card.price.amount} {card.price.unit ?? ""}
            </div>
          ) : null}
        </div>
      </div>
    ),
    size,
  );
}
