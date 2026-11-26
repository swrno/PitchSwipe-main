import { NextResponse } from "next/server";

import { readJson, resolveOwnerId } from "@/lib/decks/owner";
import { limitKey } from "@/lib/ratelimit";
import { shipDeps } from "@/lib/assistant/server";
import { getReview, shipDeck, type Outcome } from "@/lib/assistant/ship";
import { FlagsmithNotConfigured } from "@/lib/flagsmith/errors";

type Ctx = { params: Promise<{ id: string }> };
const NO_STORE = { "cache-control": "no-store" };

function send<T>(result: Outcome<T>) {
  return result.ok
    ? NextResponse.json(result.value, { headers: NO_STORE })
    : NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
}

/** GET /api/decks/[id]/ship: data for the review sheet (read only, owner only). */
export async function GET(request: Request, { params }: Ctx) {
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  try {
    return send(await getReview(await shipDeps(), who.ownerId, (await params).id));
  } catch (error) {
    console.error("ship review failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not load the review. Try again." }, { status: 500, headers: NO_STORE });
  }
}

/**
 * POST /api/decks/[id]/ship  body { approve: true, winnerKey? }
 * The only way a winner is shipped: the signed-in owner must send explicit approval.
 * Re-checks Flagsmith's decision, completes the experiment, sets weights 100/0, logs events.
 */
export async function POST(request: Request, { params }: Ctx) {
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  const limited = limitKey(`ship:${who.ownerId}`, { limit: 10, windowMs: 60_000 }, NO_STORE);
  if (limited) return limited;
  const body = (await readJson(request)) as { approve?: unknown; winnerKey?: unknown } | null;
  try {
    return send(
      await shipDeck(await shipDeps(), {
        ownerId: who.ownerId,
        deckId: (await params).id,
        approve: body?.approve,
        winnerKey: body?.winnerKey,
      }),
    );
  } catch (error) {
    if (error instanceof FlagsmithNotConfigured) {
      return NextResponse.json({ error: "Flagsmith is not configured on the server, so nothing was shipped." }, { status: 503, headers: NO_STORE });
    }
    console.error("ship failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Shipping failed. Check Results, then try again." }, { status: 502, headers: NO_STORE });
  }
}
