/**
 * The results context for an ACCOUNT-scoped chat (server only). It starts with the test the user is looking at (or their
 * newest one) and loads another product's tests on demand, but only ever through buildAskContext, whose loaders are scoped
 * to the signed-in uid (owner or active co-founder). A model-chosen id that is not the user's resolves to nothing.
 */
import { getOverview } from "@/features/decks/server/service";
import { newestDeckId } from "../latest";
import type { AskToolCtx, DeckInContext } from "../types";
import { buildAskContext } from "./data";
import { currentTestId, findTest, type Actor } from "./account";

export interface AccountAskCtx extends AskToolCtx {
  /** Loads the test named by `token` (id, or product plus variable) and returns its id; null when unknown or ambiguous. Never throws. */
  ensure(token: unknown): Promise<string | null>;
}

export async function buildAccountCtx(actor: Actor): Promise<AccountAskCtx> {
  const decks: Record<string, DeckInContext> = {};
  const owners = new Map<string, AskToolCtx>();
  let productName = "your account";

  const load = async (deckId: string): Promise<boolean> => {
    if (decks[deckId]) return true;
    const sub = await buildAskContext(actor.ownerId, deckId);
    if (!sub) return false;
    for (const [id, d] of Object.entries(sub.decks)) {
      if (!decks[id]) {
        decks[id] = d;
        owners.set(id, sub);
      }
    }
    return Boolean(decks[deckId]);
  };

  const first = (await currentTestId(actor)) ?? (await newestDeckId(actor.ownerId));
  if (first && (await load(first))) productName = owners.get(first)?.productName ?? productName;

  return {
    currentDeckId: first && decks[first] ? first : "",
    productName,
    decks,
    comments: async (id) => (decks[id] ? ((await owners.get(id)?.comments(id)) ?? []) : []),
    experiment: async (id) => (decks[id] ? ((await owners.get(id)?.experiment(id)) ?? null) : null),
    async ensure(token) {
      try {
        const wanted = typeof token === "string" ? token.trim() : "";
        if (!wanted) return null;
        if (decks[wanted]) return wanted;
        const { test } = findTest(await getOverview(actor.ownerId), wanted);
        return (await load(test.id)) ? test.id : null;
      } catch {
        // Unknown or ambiguous: the tool's own lookup reports it to the model.
        return null;
      }
    },
  };
}
