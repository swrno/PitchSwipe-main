import { NextResponse } from "next/server";
import { AuthError, ServiceUnavailableError, claimsDeps, resolveClaimant } from "@/lib/claims/server";
import { creditSwipe, parseResponseRef, walletFor } from "@/lib/claims/service";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import { isValidGuid } from "@/lib/swipe/service";
import { WALLET } from "@/fixtures";

export const runtime = "nodejs";

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many requests. Try again shortly." },
    { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil(retryAfterSeconds))) } },
  );
}

/** GET /api/claims/wallet?swiperGuid=...: the demo wallet ("Demo earnings"; no real money moves). */
export async function GET(request: Request) {
  const limited = rateLimit(clientKey(request, "claims:wallet-get"), { limit: 30, windowMs: 60_000 });
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);
  const guid = new URL(request.url).searchParams.get("swiperGuid");
  if (!isValidGuid(guid)) return NextResponse.json({ error: "Missing swiper id." }, { status: 400 });
  try {
    const { swiper } = await resolveClaimant(request, guid);
    const deps = await claimsDeps();
    // The fixture score (design web 36, "now 82") only with the in-memory demo store; real mode shows the
    // swiper's own stored score, or nothing when they have not taken the check.
    const demoScore = deps.store.demo && swiper.demo;
    const wallet = await walletFor(deps, swiper.key, {
      counting: swiper.counting,
      qualityScore: demoScore ? WALLET.currentQualityScore : swiper.qualityScore,
      demo: deps.store.demo,
    });
    return NextResponse.json({ wallet });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ServiceUnavailableError) {
      return NextResponse.json({ error: "This service is temporarily unavailable." }, { status: 503 });
    }
    console.error("wallet: could not load", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not load your wallet." }, { status: 500 });
  }
}

/**
 * POST /api/claims/wallet: credit the wallet for one answer, once (idempotent per response).
 * Rs 0.25 only for a valid, counted swipe on a paid card; everything else is recorded at Rs 0.
 * Body: { swiperGuid, responseId, token }. The amount is computed here from the stored response.
 */
export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "claims:wallet-credit"), { limit: 30, windowMs: 60_000 });
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);
  const body = await request.json().catch(() => null);
  const ref = parseResponseRef(body);
  if ("error" in ref) return NextResponse.json({ error: ref.error }, { status: 400 });
  const guid = (body as { swiperGuid?: unknown }).swiperGuid;
  if (!isValidGuid(guid)) return NextResponse.json({ error: "Missing swiper id." }, { status: 400 });
  try {
    const { context } = await resolveClaimant(request, guid);
    const outcome = await creditSwipe(await claimsDeps(), ref.responseId, context.swiperKey, ref.token);
    if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    return NextResponse.json(outcome);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ServiceUnavailableError) {
      return NextResponse.json({ error: "This service is temporarily unavailable." }, { status: 503 });
    }
    console.error("wallet: could not credit", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not update your wallet." }, { status: 500 });
  }
}
