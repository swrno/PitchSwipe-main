import { NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import { AuthError, ServiceUnavailableError, defaultDeps, resolveSwiper } from "@/lib/swipe/server";
import { nextCard, parseNextBody } from "@/lib/swipe/service";

export const runtime = "nodejs";

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many requests. Try again shortly." },
    { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil(retryAfterSeconds))) } },
  );
}

/**
 * POST /api/responses/next: the next card for this swiper.
 * Random deck order, each deck once; the personal-link deck (firstSlug) comes first. Flagsmith picks
 * which card of the deck the swiper gets (via src/lib/flagsmith); without Flagsmith or Mongo env the
 * demo decks from src/lib/swipe/demo.ts are served. Every card carries a server-signed `token` (deck,
 * swiper, card, servedAt, source) that /api/responses and the claim routes require. Without
 * SWIPE_SIGNING_SECRET in production this refuses to serve (503).
 */
export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "responses:next"), { limit: 60, windowMs: 60_000 });
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);
  const parsed = parseNextBody(await request.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const swiper = await resolveSwiper(request, parsed.guid);
    const result = await nextCard(await defaultDeps(), {
      swiper,
      firstSlug: parsed.firstSlug,
      interests: parsed.interests,
      seen: parsed.seen,
    });
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ServiceUnavailableError) {
      return NextResponse.json({ error: "This service is temporarily unavailable." }, { status: 503 });
    }
    console.error("responses/next: could not load a card", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not load the next idea." }, { status: 500 });
  }
}
