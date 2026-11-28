import { NextResponse } from "next/server";
import { readJson, resolveOwnerId, respond } from "@/features/decks/server/owner";
import { createProduct, listProducts } from "@/features/decks/server/service";
import { limitKey } from "@/shared/lib/ratelimit";

/** GET /api/products: the founder's products. POST: create a product. */
export async function GET(request: Request) {
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  return NextResponse.json({ products: await listProducts(who.ownerId) });
}

export async function POST(request: Request) {
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  const limited = limitKey(`products:create:${who.ownerId}`, { limit: 30, windowMs: 60_000 });
  if (limited) return limited;
  return respond(await createProduct(who.ownerId, await readJson(request)), 201);
}
