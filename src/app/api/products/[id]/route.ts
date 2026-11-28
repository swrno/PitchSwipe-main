import { readJson, resolveOwnerId, respond } from "@/features/decks/server/owner";
import { getProduct, updateProduct } from "@/features/decks/server/service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  return respond(await getProduct(who.ownerId, (await params).id));
}

/** PATCH /api/products/[id]: save product settings. Applies to new decks only (running decks keep their publish-time snapshot). */
export async function PATCH(request: Request, { params }: Ctx) {
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  return respond(await updateProduct(who.ownerId, (await params).id, await readJson(request)));
}

export { PATCH as PUT };
