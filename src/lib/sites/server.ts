/** Default (env-backed) wiring for the sites routes. Server only. */
import { createDeckSource } from "@/lib/assistant/sources";
import { getAssistantStore } from "@/lib/assistant/store";
import { getStore } from "@/lib/decks/store";

import { createRateLimiter } from "./ratelimit";
import type { Catalog, DeckContext, DeckInfo, PingLimiters, SiteDeps } from "./service";
import { getSitesStore } from "./store";

const str = (v: unknown) => (typeof v === "string" ? v : undefined);

const catalog: Catalog = {
  async getProduct(ownerId, productId) {
    const p = await (await getStore()).getProduct(ownerId, productId);
    return p ? { id: p.id, name: p.name } : null;
  },
  async listProductDecks(ownerId, productId) {
    const decks = (await (await getStore()).listDecks(ownerId)).filter((d) => d.productId === productId);
    return decks.map<DeckInfo>((d) => ({
      id: d._id,
      flagName: d.flagName,
      variable: d.variable,
      status: d.status,
      text: str(d.cards[0]?.value) ?? str((d.shared as Record<string, unknown>)[d.variable]),
    }));
  },
  async getDeckContext(ownerId, deckId): Promise<DeckContext | null> {
    const watched = await createDeckSource().getForOwner(ownerId, deckId);
    if (!watched) return null;
    const deck = await (await getStore()).getDeck(ownerId, deckId);
    if (!deck) return null;
    return {
      deckId,
      productId: deck.productId,
      productName: watched.productName,
      noun: watched.noun,
      flagName: watched.flagName,
      controlKey: watched.controlKey,
      cards: watched.cards.map((c) => ({ key: c.key, text: c.text })),
      shared: { description: deck.shared.description, reward: deck.shared.reward, price: deck.shared.price },
    };
  },
};

export async function siteDeps(): Promise<SiteDeps> {
  return {
    sites: getSitesStore(),
    catalog,
    getShip: (deckId) => getAssistantStore().getShip(deckId),
    demo: (await getStore()).demo,
    envKey: process.env.NEXT_PUBLIC_FLAGSMITH_ENV_KEY,
  };
}

const g = globalThis as unknown as { __pitchswipePingLimiters?: PingLimiters };

/** One set per server process: 60 pings a minute per IP, 300 a minute per site. */
export function pingLimiters(): PingLimiters {
  return (g.__pitchswipePingLimiters ??= {
    perIp: createRateLimiter({ limit: 60, windowMs: 60_000 }),
    perSite: createRateLimiter({ limit: 300, windowMs: 60_000 }),
  });
}
