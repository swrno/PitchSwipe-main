import { NextResponse } from "next/server";

import { resolveOwnerId } from "@/features/decks/server/owner";
import { deleteChat, forBrowser, getChat } from "@/features/ask/server/history";
import { limitRequest } from "@/shared/lib/ratelimit";

export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "no-store" };
type Ctx = { params: Promise<{ chatId: string }> };

const notFound = () => NextResponse.json({ error: "Chat not found." }, { status: 404, headers: NO_STORE });

/** GET /api/chat/history/[chatId]: the messages of one saved chat. Another user's chat is 404. */
export async function GET(request: Request, { params }: Ctx) {
  const early = limitRequest(request, "chat-history:ip", { limit: 120, windowMs: 60_000 }, NO_STORE);
  if (early) return early;
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  try {
    const chat = await getChat(who.ownerId, (await params).chatId);
    return chat ? NextResponse.json({ chat: forBrowser(chat) }, { headers: NO_STORE }) : notFound();
  } catch (error) {
    console.error("chat history: read failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not load that chat." }, { status: 503, headers: NO_STORE });
  }
}

/** DELETE /api/chat/history/[chatId]: removes one of the user's chats. Another user's chat is 404. */
export async function DELETE(request: Request, { params }: Ctx) {
  const early = limitRequest(request, "chat-history:ip", { limit: 120, windowMs: 60_000 }, NO_STORE);
  if (early) return early;
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  try {
    return (await deleteChat(who.ownerId, (await params).chatId)) ? NextResponse.json({ deleted: true }, { headers: NO_STORE }) : notFound();
  } catch (error) {
    console.error("chat history: delete failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not delete that chat." }, { status: 503, headers: NO_STORE });
  }
}
