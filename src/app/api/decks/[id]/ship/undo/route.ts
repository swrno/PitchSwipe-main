import { NextResponse } from "next/server";

import { resolveOwnerId } from "@/features/decks/server/owner";
import { limitKey } from "@/shared/lib/ratelimit";
import { shipDeps } from "@/features/assistant/server/server";
import { undoDeck } from "@/features/assistant/ship";
import { FlagsmithNotConfigured, FlagsmithVersioningError } from "@/features/flagsmith/errors";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/decks/[id]/ship/undo (owner only): writes the pre-ship flag state back, which serves the control card
 * to everyone. The experiment stays completed; the test split does not come back.
 */
export async function POST(request: Request, { params }: Ctx) {
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  const limited = limitKey(`ship-undo:${who.ownerId}`, { limit: 10, windowMs: 60_000 });
  if (limited) return limited;
  try {
    const result = await undoDeck(await shipDeps(), { ownerId: who.ownerId, deckId: (await params).id });
    return result.ok
      ? NextResponse.json(result.value)
      : NextResponse.json({ error: result.error }, { status: result.status });
  } catch (error) {
    if (error instanceof FlagsmithNotConfigured) {
      return NextResponse.json({ error: "Flagsmith is not configured on the server." }, { status: 503 });
    }
    // v2 feature versioning refuses direct feature-state writes: retrying cannot help, so say what to change.
    if (error instanceof FlagsmithVersioningError || (error as { code?: unknown })?.code === "FLAGSMITH_V2_VERSIONING") {
      return NextResponse.json({ error: (error as Error).message }, { status: 409 });
    }
    console.error("undo failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not switch back. Try again." }, { status: 502 });
  }
}
