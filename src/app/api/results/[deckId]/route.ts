import { NextResponse } from "next/server";

import { resolveOwnerId } from "@/lib/decks/owner";
import { loadResults, loadSwitcher, loadWaitlistCsv } from "@/lib/results/load";

type Ctx = { params: Promise<{ deckId: string }> };

const NO_STORE = { "cache-control": "no-store" };

/**
 * GET /api/results/[deckId]            full Results + Who swiped payload (aggregates only)
 * GET /api/results/[deckId]?view=switcher   the deck switcher list for the deck's product
 * GET /api/results/[deckId]?format=csv      the waitlist (people who claimed the reward) as CSV
 *
 * Owner only: the deck store is scoped to the signed-in founder, so another founder's deck is a 404.
 * Founders see aggregates: no names, no raw IPs, and emails only for explicit waitlist claimants.
 */
export async function GET(request: Request, { params }: Ctx) {
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  const { deckId } = await params;
  const url = new URL(request.url);

  try {
    if (url.searchParams.get("format") === "csv") {
      const csv = await loadWaitlistCsv(who.ownerId, deckId);
      if (csv === null) return NextResponse.json({ error: "Deck not found." }, { status: 404, headers: NO_STORE });
      return new NextResponse(csv, {
        headers: {
          ...NO_STORE,
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="waitlist-${encodeURIComponent(deckId)}.csv"`,
        },
      });
    }

    if (url.searchParams.get("view") === "switcher") {
      const view = await loadSwitcher(who.ownerId, deckId);
      if (!view) return NextResponse.json({ error: "Deck not found." }, { status: 404, headers: NO_STORE });
      return NextResponse.json(view, { headers: NO_STORE });
    }

    const payload = await loadResults(who.ownerId, deckId);
    if (!payload) return NextResponse.json({ error: "Deck not found." }, { status: 404, headers: NO_STORE });
    return NextResponse.json(payload, { headers: NO_STORE });
  } catch (error) {
    console.error("results: could not load", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not load the results. Try again." }, { status: 500, headers: NO_STORE });
  }
}
