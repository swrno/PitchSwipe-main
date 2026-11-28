/** Default (env-backed) wiring for the assistant routes. Server only. */
import { defaultMailer } from "./mailer";
import type { FlagsmithPort, ShipDeps } from "../ship";
import { createDeckSource, createResultsSource } from "./sources";
import { getAssistantStore } from "./store";
import type { WatcherDeps } from "./watcher";

let flagsmithPort: FlagsmithPort | undefined;

/** Flagsmith admin through the wrapper (the only module that talks to Flagsmith). */
async function realFlagsmith(): Promise<FlagsmithPort> {
  if (flagsmithPort) return flagsmithPort;
  const { createFlagsmith } = await import("@/features/flagsmith");
  const store = (await import("@/features/flagsmith/server/mongo-store")).createMongoStore();
  const { admin } = createFlagsmith({ store });
  flagsmithPort = {
    snapshotFlag: (f) => admin.snapshotFlag(f),
    completeExperiment: (id, decision) => admin.completeExperiment(id, decision),
    optionIdsForFlag: (f) => admin.optionIdsForFlag(f),
    setFlagWeights: (f, c, w, o) => admin.setFlagWeights(f, c, w, o),
    undoShip: (f, s) => admin.undoShip(f, s),
  };
  return flagsmithPort;
}

/** One code-filled insight line from the Who swiped tabs (WP7). Null when there is none. */
async function insightFor(ownerId: string, deckId: string): Promise<string | null> {
  try {
    const { loadResults } = await import("@/features/results/server/load");
    const payload = await loadResults(ownerId, deckId);
    const who = payload?.whoSwiped;
    return who?.target.insight?.body ?? who?.location.insight?.body ?? null;
  } catch {
    return null;
  }
}

/** Domain of the product's connected website, for the "your website switches too" step. Null when none is connected. */
async function siteDomainFor(ownerId: string, deckId: string): Promise<string | null> {
  try {
    const { siteDeps } = await import("@/features/sites/server/server");
    const deps = await siteDeps();
    const ctx = await deps.catalog.getDeckContext(ownerId, deckId);
    if (!ctx) return null;
    const site = await deps.sites.getByProduct(ctx.productId);
    return site?.domain ?? null;
  } catch {
    return null;
  }
}

export async function shipDeps(): Promise<ShipDeps> {
  return {
    decks: createDeckSource(),
    results: createResultsSource(),
    store: getAssistantStore(),
    flagsmith: await realFlagsmith(),
    insight: (deck) => insightFor(deck.ownerId, deck.deckId),
    siteDomain: (deck) => siteDomainFor(deck.ownerId, deck.deckId),
  };
}

export function watcherDeps(): WatcherDeps {
  return {
    decks: createDeckSource(),
    results: createResultsSource(),
    store: getAssistantStore(),
    mailer: defaultMailer(),
    baseUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000",
  };
}
