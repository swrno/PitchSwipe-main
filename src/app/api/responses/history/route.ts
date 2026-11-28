import { NextResponse } from "next/server";
import { notConfiguredResponse } from "@/shared/lib/not-configured";
import { AuthError, ServiceUnavailableError, claimsDeps, resolveClaimant } from "@/features/claims/server/server";
import { historyFor } from "@/features/claims/server/service";
import { parseCursor } from "@/features/claims/history";
import { clientKey, rateLimit } from "@/shared/lib/ratelimit";
import { isValidGuid } from "@/features/swipe/server/service";

export const runtime = "nodejs";

/** GET /api/swipes/history?swiperGuid=...&cursor=...: the signed-in swiper's own answers, newest first, 50 a page. */
export async function GET(request: Request) {
  const limited = rateLimit(clientKey(request, "swipes:history"), { limit: 30, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil(limited.retryAfterSeconds))) } },
    );
  }
  if (!request.headers.get("authorization")) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const guid = params.get("swiperGuid");
  if (!isValidGuid(guid)) return NextResponse.json({ error: "Missing swiper id." }, { status: 400 });
  const before = parseCursor(params.get("cursor"));
  if (before === "invalid") return NextResponse.json({ error: "Invalid cursor." }, { status: 400 });
  try {
    const { swiper, context } = await resolveClaimant(request, guid);
    if (swiper.guest) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const page = await historyFor(await claimsDeps(), swiper.key, { before, email: context.email });
    return NextResponse.json(page);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ServiceUnavailableError) return notConfiguredResponse();
    console.error("history: could not load", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not load your history." }, { status: 500 });
  }
}
