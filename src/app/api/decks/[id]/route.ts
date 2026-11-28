import { readJson, resolveOwnerId, respond } from "@/features/decks/server/owner";
import { getDeck, patchDeck, removeDeck } from "@/features/decks/server/service";
import { limitKey } from "@/shared/lib/ratelimit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  return respond(await getDeck(who.ownerId, (await params).id));
}

/**
 * PATCH /api/decks/[id]
 * Draft: any content change (re-validated); { publish: true } publishes.
 * Published: content changes are rejected with 409 (locked fields, immutable cards);
 * only { productId } (move) and { archived: true } are accepted.
 */
export async function PATCH(request: Request, { params }: Ctx) {
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  const limited = limitKey(`decks:patch:${who.ownerId}`, { limit: 120, windowMs: 60_000 });
  if (limited) return limited;
  return respond(await patchDeck(who.ownerId, (await params).id, await readJson(request)));
}

/** DELETE: drafts only. */
export async function DELETE(request: Request, { params }: Ctx) {
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  return respond(await removeDeck(who.ownerId, (await params).id));
}
