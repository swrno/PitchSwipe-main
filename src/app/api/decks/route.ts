import { NextResponse } from "next/server";
import { readJson, resolveOwnerId, respond } from "@/features/decks/server/owner";
import { createDeck, getOverview, listDecks } from "@/features/decks/server/service";
import { limitKey } from "@/shared/lib/ratelimit";

/**
 * GET /api/decks            -> { decks } with cards
 * GET /api/decks?overview=1 -> My decks view model (products with deck rows and statuses)
 * POST /api/decks           -> create a draft, or publish with { publish: true }
 */
export async function GET(request: Request) {
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  if (new URL(request.url).searchParams.get("overview")) return NextResponse.json(await getOverview(who.ownerId));
  return NextResponse.json({ decks: await listDecks(who.ownerId) });
}

export async function POST(request: Request) {
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  const limited = limitKey(`decks:create:${who.ownerId}`, { limit: 30, windowMs: 60_000 });
  if (limited) return limited;
  return respond(await createDeck(who.ownerId, await readJson(request)), 201);
}
