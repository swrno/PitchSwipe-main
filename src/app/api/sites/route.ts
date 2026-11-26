import { NextResponse } from "next/server";

import { readJson, resolveOwnerId } from "@/lib/decks/owner";
import { limitKey } from "@/lib/ratelimit";
import { connectSite, getSiteView } from "@/lib/sites/service";
import { siteDeps } from "@/lib/sites/server";

const NO_STORE = { "cache-control": "no-store" };

/** GET /api/sites?productId=...: connect screen data (status, rows, snippet). Owner only. */
export async function GET(request: Request) {
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  if (!productId) return NextResponse.json({ error: "productId is required." }, { status: 400 });
  try {
    const result = await getSiteView(await siteDeps(), { ownerId: who.ownerId, productId, baseUrl: url.origin });
    return result.ok
      ? NextResponse.json(result.value, { headers: NO_STORE })
      : NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
  } catch (error) {
    console.error("sites: view failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not load your website settings. Try again." }, { status: 500, headers: NO_STORE });
  }
}

/** POST /api/sites  body { productId, domain }: connect or change the product's website. Owner only. */
export async function POST(request: Request) {
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  const limited = limitKey(`sites:connect:${who.ownerId}`, { limit: 20, windowMs: 60_000 }, NO_STORE);
  if (limited) return limited;
  const body = (await readJson(request)) as { productId?: unknown; domain?: unknown } | null;
  try {
    const result = await connectSite(await siteDeps(), { ownerId: who.ownerId, productId: body?.productId, domain: body?.domain });
    return result.ok
      ? NextResponse.json({ id: result.value.id, productId: result.value.productId, domain: result.value.domain }, { status: 201, headers: NO_STORE })
      : NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
  } catch (error) {
    console.error("sites: connect failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not save your website. Try again." }, { status: 500, headers: NO_STORE });
  }
}
