import { NextResponse } from "next/server";

import { resolveOwnerId } from "@/features/decks/server/owner";
import { limitRequest } from "@/shared/lib/ratelimit";
import { resolvePage } from "@/features/ask";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

/**
 * GET /api/ask?pathname=/decks/abc/waitlist   the page context for the Ask panel header: page name plus the product and test
 * in view, only when the signed-in user may open them. The chat itself is POST /api/chat (AI SDK stream).
 */
export async function GET(request: Request) {
  const early = limitRequest(request, "ask:get", { limit: 120, windowMs: 60_000 }, NO_STORE);
  if (early) return early;
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  try {
    const pathname = (new URL(request.url).searchParams.get("pathname") ?? "/").slice(0, 200);
    return NextResponse.json({ page: await resolvePage({ ownerId: who.ownerId, pathname }) }, { headers: NO_STORE });
  } catch (error) {
    console.error("ask: could not load", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not load this chat. Try again." }, { status: 500, headers: NO_STORE });
  }
}
