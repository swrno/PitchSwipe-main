import { NextResponse } from "next/server";

import { resolveOwnerId, readJson } from "@/features/decks/server/owner";
import { limitKey, limitRequest } from "@/shared/lib/ratelimit";
import { buildAskContext, cleanMessages, newestDeckId, runChat, sayModel } from "@/features/ask";
import { streamText } from "ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = { "cache-control": "no-store" };

/**
 * POST /api/chat   { messages, deckId? } -> AI SDK UI message stream (tool calls, `show` components, checked text).
 *
 * Founder only, same limits as the old /api/ask. Reads and drafts only: there is no publish, ship, stop or flag tool.
 * No deckId: the owner's newest deck. No decks: a short text asking them to create one.
 */
export async function POST(request: Request) {
  const early = limitRequest(request, "chat:ip", { limit: 60, windowMs: 60_000 }, NO_STORE);
  if (early) return early;
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  // Each answer can be several paid model calls: cap it per founder.
  const limited = limitKey(`chat:owner:${who.ownerId}`, { limit: 12, windowMs: 60_000 }, NO_STORE);
  if (limited) return limited;

  const body = (await readJson(request)) as { messages?: unknown; deckId?: unknown } | null;
  const messages = cleanMessages(body?.messages);
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Type a question first." }, { status: 400, headers: NO_STORE });
  }

  try {
    const asked = typeof body?.deckId === "string" ? body.deckId : "";
    const deckId = asked || (await newestDeckId(who.ownerId));
    if (!deckId) {
      return streamText({ model: sayModel("You have no tests yet. Create a test first, then ask about its results."), prompt: "." }).toUIMessageStreamResponse({
        headers: NO_STORE,
      });
    }
    const ctx = await buildAskContext(who.ownerId, deckId);
    if (!ctx) return NextResponse.json({ error: "Test not found." }, { status: 404, headers: NO_STORE });
    return runChat({ ctx, messages, abortSignal: request.signal });
  } catch (error) {
    console.error("chat: failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not answer that. Try again." }, { status: 502, headers: NO_STORE });
  }
}
