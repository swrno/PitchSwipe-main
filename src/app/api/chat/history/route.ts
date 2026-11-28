import { NextResponse } from "next/server";

import { resolveOwnerId } from "@/features/decks/server/owner";
import { listChats } from "@/features/ask/server/history";
import { limitRequest } from "@/shared/lib/ratelimit";

export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "no-store" };

/** GET /api/chat/history: the signed-in user's 20 most recent chats, { chats: [{ chatId, title, updatedAt }] }. */
export async function GET(request: Request) {
  const early = limitRequest(request, "chat-history:ip", { limit: 120, windowMs: 60_000 }, NO_STORE);
  if (early) return early;
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  try {
    return NextResponse.json({ chats: await listChats(who.ownerId) }, { headers: NO_STORE });
  } catch (error) {
    console.error("chat history: list failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not load your chats." }, { status: 503, headers: NO_STORE });
  }
}
