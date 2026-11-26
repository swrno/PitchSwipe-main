/**
 * Who is calling a founder API route (server only).
 *  - Demo mode (no MONGODB_URI): the demo founder, no sign-in.
 *  - Otherwise: the verified Firebase ID token, mapped to the Mongo `users` row.
 * Every query is scoped by this owner id, so one founder can never read or write another's decks.
 */
import { NextResponse } from "next/server";
import { AuthError, verifyRequestToken } from "@/lib/auth/server";
import { connectDb } from "@/lib/db";
import { User } from "@/models";
import { DEMO_OWNER_ID } from "./store-memory";
import { isDemoMode, isMisconfigured } from "./store";
import type { ServiceResult } from "./service";

export async function resolveOwnerId(request: Request): Promise<{ ownerId: string } | { response: NextResponse }> {
  if (isDemoMode()) return { ownerId: DEMO_OWNER_ID };
  if (isMisconfigured()) {
    console.error("decks: storage is not configured (set MONGODB_URI, or PITCHSWIPE_DEMO=1 for a demo)");
    return { response: NextResponse.json({ error: "This service is not available right now." }, { status: 503 }) };
  }
  try {
    const token = await verifyRequestToken(request);
    // An unverified address could be someone else's: founders must have verified their email.
    if (token.email_verified !== true) {
      return { response: NextResponse.json({ error: "Verify your email first.", code: "unverified" }, { status: 403 }) };
    }
    await connectDb();
    const user = (await User.findOne({ firebaseUid: token.uid }).select("_id").lean()) as { _id: unknown } | null;
    if (!user) {
      return { response: NextResponse.json({ error: "Finish creating your profile first." }, { status: 401 }) };
    }
    return { ownerId: String(user._id) };
  } catch (error) {
    if (error instanceof AuthError) {
      // Never tell a caller which env vars are missing.
      const message = error.code === "not_configured" ? "Sign-in is not available right now." : error.message;
      if (error.code === "not_configured") console.error("decks: auth not configured:", error.message);
      return { response: NextResponse.json({ error: message }, { status: error.status }) };
    }
    console.error("decks: could not resolve owner", error instanceof Error ? error.message : error);
    return { response: NextResponse.json({ error: "Could not check your sign-in." }, { status: 500 }) };
  }
}

/** Maps a service result to a JSON response. */
export function respond<T>(result: ServiceResult<T>, successStatus = 200): NextResponse {
  if (result.ok) return NextResponse.json(result.value, { status: successStatus });
  return NextResponse.json({ error: result.error, errors: result.errors }, { status: result.status });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
