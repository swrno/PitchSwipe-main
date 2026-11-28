import { NextResponse } from "next/server";

import { resolveOwnerId } from "@/features/decks/server/owner";
import { loadInsights } from "@/features/insights";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

/**
 * GET /api/insights/[productId]: product insights across every deck of the product (spec 05 section 6.3).
 *
 * Founder only: the signed-in owner is resolved first and every read is owner-scoped, so another
 * founder's product answers 404, not 403. Aggregates only: no names, emails, raw IPs or audio URLs.
 * Every number is filled by code and every sentence the model writes is post-checked; read only, it
 * cannot publish, ship, stop a test or change a flag.
 */
export async function GET(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  const { productId } = await params;
  try {
    const payload = await loadInsights(who.ownerId, productId);
    if (!payload) return NextResponse.json({ error: "Product not found." }, { status: 404, headers: NO_STORE });
    return NextResponse.json(payload, { headers: NO_STORE });
  } catch (error) {
    console.error("insights: could not load", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not load the insights. Try again." }, { status: 500, headers: NO_STORE });
  }
}
