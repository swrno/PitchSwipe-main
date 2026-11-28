import { NextResponse } from "next/server";
import { verifyRequestToken } from "@/features/auth/server/server";
import { acceptInvite } from "@/features/decks/server/members";
import { readJson, resolveOwnerId, respond } from "@/features/decks/server/owner";
import { limitKey, limitRequest } from "@/shared/lib/ratelimit";

const NO_STORE = { "cache-control": "no-store" };

/**
 * POST /api/invites/accept { token }: the signed-in founder joins the product as a co-founder.
 * Their VERIFIED Firebase email must equal the invited address (taken from the ID token, never the body); the token
 * works once and not after its 14 days (410).
 */
export async function POST(request: Request) {
  const early = limitRequest(request, "invites:accept:ip", { limit: 30, windowMs: 60_000 }, NO_STORE);
  if (early) return early;
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  const limited = limitKey(`invites:accept:${who.ownerId}`, { limit: 10, windowMs: 60_000 }, NO_STORE);
  if (limited) return limited;
  let email: string | undefined;
  let verified = false;
  try {
    const decoded = await verifyRequestToken(request);
    email = decoded.email;
    verified = decoded.email_verified === true;
  } catch {
    return NextResponse.json({ error: "Sign in to accept this invite." }, { status: 401, headers: NO_STORE });
  }
  const body = (await readJson(request)) as { token?: unknown } | null;
  return respond(await acceptInvite({ uid: who.ownerId, email, emailVerified: verified }, body?.token));
}
