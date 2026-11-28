import { NextResponse } from "next/server";
import { notConfiguredResponse } from "@/shared/lib/not-configured";
import { AuthError, ServiceUnavailableError, claimsDeps, resolveClaimant } from "@/features/claims/server/server";
import { creditSwipe, parseResponseRef, walletFor } from "@/features/claims/server/service";
import { clientKey, rateLimit } from "@/shared/lib/ratelimit";
import { isValidGuid } from "@/features/swipe/server/service";

export const runtime = "nodejs";

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many requests. Try again shortly." },
    { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil(retryAfterSeconds))) } },
  );
}

/** GET /api/claims/wallet?swiperGuid=...: the swiper's wallet (payouts are not live yet). */
export async function GET(request: Request) {
  const limited = rateLimit(clientKey(request, "claims:wallet-get"), { limit: 30, windowMs: 60_000 });
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);
  const guid = new URL(request.url).searchParams.get("swiperGuid");
  if (!isValidGuid(guid)) return NextResponse.json({ error: "Missing swiper id." }, { status: 400 });
  // The wallet belongs to a signed-in swiper: a signed-out request gets no data.
  if (!request.headers.get("authorization")) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  try {
    const { swiper } = await resolveClaimant(request, guid);
    const deps = await claimsDeps();
    // The swiper's own stored score, or nothing when they have not taken the check.
    const wallet = await walletFor(deps, swiper.key, { counting: swiper.counting, qualityScore: swiper.qualityScore });
    return NextResponse.json({ wallet });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ServiceUnavailableError) {
      return notConfiguredResponse();
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
      return notConfiguredResponse();
    }
    console.error("wallet: could not credit", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not update your wallet." }, { status: 500 });
  }
}
