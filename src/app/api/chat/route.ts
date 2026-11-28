import { NextResponse } from "next/server";

import { resolveOwnerId, readJson } from "@/features/decks/server/owner";
import { limitKey, limitRequest } from "@/shared/lib/ratelimit";
import type { Actor } from "@/features/ask/server/account";
import { isChatId, isForeignChat, saveTurn } from "@/features/ask/server/history";
import { buildAccountCtx, canAnswer, cleanChatMessages, resolvePage, runChat } from "@/features/ask";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = { "cache-control": "no-store" };

interface ChatBody {
  messages?: unknown;
  /** The page the user is on, e.g. "/decks/abc123/waitlist". Context only: ids in it are re-checked against the user's access. */
  pathname?: unknown;
  timeZone?: unknown;
  theme?: unknown;
  /** The saved-chat id the browser keeps for this conversation. Saved under the signed-in uid only. */
  chatId?: unknown;
}

const clip = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");

/**
 * POST /api/chat   { messages, pathname, timeZone, theme } -> AI SDK UI message stream (tool calls, cards, approval requests, checked text).
 *
 * The chat is scoped to the signed-in user's ACCOUNT, not one deck. The page is context only. Reads run at once; every
 * action (create, publish, invite, ...) stops for the user's approval in the chat and re-checks access in the services.
 */
export async function POST(request: Request) {
  const early = limitRequest(request, "chat:ip", { limit: 60, windowMs: 60_000 }, NO_STORE);
  if (early) return early;
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  // Each answer can be several paid model calls: cap it per user.
  const limited = limitKey(`chat:owner:${who.ownerId}`, { limit: 12, windowMs: 60_000 }, NO_STORE);
  if (limited) return limited;

  const body = (await readJson(request)) as ChatBody | null;
  const messages = cleanChatMessages(body?.messages);
  if (!canAnswer(messages)) {
    return NextResponse.json({ error: "Type a question first." }, { status: 400, headers: NO_STORE });
  }

  const chatId = isChatId(body?.chatId) ? body.chatId : null;
  try {
    // A chat id that belongs to someone else is not found, and nothing is ever written to it.
    if (chatId && (await isForeignChat(who.ownerId, chatId))) return NextResponse.json({ error: "Chat not found." }, { status: 404, headers: NO_STORE });
    const theme = body?.theme as { mode?: unknown; presetId?: unknown } | undefined;
    const actor: Actor = {
      ownerId: who.ownerId,
      pathname: clip(body?.pathname, 200) || "/",
      timeZone: clip(body?.timeZone, 64) || "UTC",
      baseUrl: new URL(request.url).origin,
      userText: [...messages].reverse().find((m) => m.role === "user")?.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ") ?? "",
      theme: theme?.mode === "light" || theme?.mode === "dark" ? { mode: theme.mode, presetId: clip(theme.presetId, 32) || "pitchswipe" } : undefined,
    };
    const [ctx, page] = await Promise.all([buildAccountCtx(actor), resolvePage(actor)]);
    return await runChat({
      ctx,
      actor,
      page,
      messages,
      abortSignal: request.signal,
      onTurnFinish: chatId ? async (response) => void (await saveTurn({ uid: who.ownerId, chatId, sent: body?.messages, response })) : undefined,
    });
  } catch (error) {
    console.error("chat: failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not answer that. Try again." }, { status: 502, headers: NO_STORE });
  }
}
