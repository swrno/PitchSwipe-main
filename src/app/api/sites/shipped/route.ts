import { NextResponse } from "next/server";

import { resolveOwnerId } from "@/lib/decks/owner";
import { getWebsiteShipped } from "@/lib/sites/service";
import { siteDeps } from "@/lib/sites/server";

const NO_STORE = { "cache-control": "no-store" };

/**
 * GET /api/sites/shipped?deckId=...: before/after data for the shipped change (web 22). Owner only.
 * Undo is not here: the screen calls POST /api/decks/[id]/ship/undo (WP8).
 */
export async function GET(request: Request) {
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  const deckId = new URL(request.url).searchParams.get("deckId");
  if (!deckId) return NextResponse.json({ error: "deckId is required." }, { status: 400 });
  try {
    const result = await getWebsiteShipped(await siteDeps(), { ownerId: who.ownerId, deckId });
    return result.ok
      ? NextResponse.json(result.value, { headers: NO_STORE })
      : NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
  } catch (error) {
    console.error("sites: shipped view failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not load the website view. Try again." }, { status: 500, headers: NO_STORE });
  }
}
