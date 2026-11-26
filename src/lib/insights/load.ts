/**
 * Server-only loader for the product insights page and GET /api/insights/[productId].
 *
 * Reuses the WP13 chat context (which itself uses the WP7 results loaders), so owner scoping, the
 * 10-swiper rule and the Flagsmith reads are the same as the Results screens. A founder can only load
 * their own product: the store is scoped by owner, and the deck list comes from the same owner.
 *  - Demo mode (no MONGODB_URI) with the Voice Khata demo product: fixtures from demo.ts.
 *  - Otherwise: real aggregates; no persona data exists yet, so no persona card.
 */
import { buildAskContext } from "@/lib/ask";
import { accentFor } from "@/lib/decks/product";
import { getStore } from "@/lib/decks/store";

import { buildInsights, type CommentSet } from "./build";
import { PRODUCT_TOTALS } from "@/fixtures";
import { DEMO_PRODUCT_ID, DEMO_SUGGESTION, demoDecks, demoPersona } from "./demo";
import { deckFactsFromResults } from "./facts";
import { insightsProvider } from "./provider";
import type { DeckFacts, InsightsPayload } from "./types";

export async function loadInsights(ownerId: string, productId: string, now: Date = new Date()): Promise<InsightsPayload | null> {
  const store = await getStore();
  const product = await store.getProduct(ownerId, productId);
  if (!product) return null;

  const tested = (await store.listDecks(ownerId)).filter((d) => d.productId === product.id && d.status !== "draft" && d.status !== "closed");
  const anchor = tested[0]?._id ?? null;
  const ctx = anchor ? await buildAskContext(ownerId, anchor, now) : null;

  const useDemo = store.demo && product.id === DEMO_PRODUCT_ID;
  let decks: DeckFacts[] = [];
  const commentSets: CommentSet[] = [];

  if (useDemo) decks = demoDecks();
  if (ctx) {
    const entries = Object.values(ctx.decks);
    const loaded = await Promise.all(entries.map(async (e) => ({ e, exp: await ctx.experiment(e.id), comments: await ctx.comments(e.id) })));
    if (!useDemo) decks = loaded.map(({ e, exp, comments }, i) => deckFactsFromResults(e.payload, exp, comments.length, i + 1));
    for (const { e, comments } of loaded) {
      commentSets.push({ deckId: e.id, deckLabel: e.label, comments: comments.map((c) => ({ id: c.id, text: c.text })) });
    }
  }

  return buildInsights({
    demo: store.demo,
    productId: product.id,
    productName: product.name,
    productIcon: product.icon || product.name.slice(0, 1),
    accent: accentFor(product.name),
    anchorDeckId: useDemo ? decks[0].id : (ctx ? Object.keys(ctx.decks)[0] : null) ?? anchor,
    decks,
    commentSets,
    persona: useDemo ? demoPersona() : null,
    distinctSwipers: useDemo ? PRODUCT_TOTALS.voiceKhataSwipers : undefined,
    suggestionText: useDemo ? DEMO_SUGGESTION : null,
    provider: insightsProvider(store.demo),
    now,
  });
}
