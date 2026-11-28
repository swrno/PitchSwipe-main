import { NextResponse } from "next/server";

import { resolveOwnerId } from "@/features/decks/server/owner";
import { limitRequest } from "@/shared/lib/ratelimit";
import { buildAskContext, contextHeader, newestDeckId, suggestedQuestions } from "@/features/ask";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

/**
 * GET /api/ask?deckId=...   header numbers and suggested questions for the Ask panel (no deckId: the newest deck).
 * The chat itself is POST /api/chat (AI SDK stream).
 *
 * Founder only: the signed-in owner is resolved first and every read goes through owner-scoped loaders.
 */
export async function GET(request: Request) {
  const early = limitRequest(request, "ask:get", { limit: 120, windowMs: 60_000 }, NO_STORE);
  if (early) return early;
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  try {
    const deckId = new URL(request.url).searchParams.get("deckId") || (await newestDeckId(who.ownerId)) || "";
    if (!deckId) return NextResponse.json({ header: null, suggestions: [] }, { headers: NO_STORE });
    const ctx = deckId ? await buildAskContext(who.ownerId, deckId) : null;
    if (!ctx) return NextResponse.json({ error: "Deck not found." }, { status: 404, headers: NO_STORE });
    return NextResponse.json({ header: contextHeader(ctx), suggestions: suggestedQuestions(ctx) }, { headers: NO_STORE });
  } catch (error) {
    console.error("ask: could not load", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not load this chat. Try again." }, { status: 500, headers: NO_STORE });
  }
}
