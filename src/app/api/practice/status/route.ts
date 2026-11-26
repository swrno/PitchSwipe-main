import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { AuthError, verifyRequestToken } from "@/lib/auth/server";
import { QUALITY, isCounting } from "@/lib/quality";
import { isSwipeDemoMode } from "@/lib/swipe/store";
import { User } from "@/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/practice/status: the signed-in swiper's saved score, counting flag and reasons. */
export async function GET(request: Request) {
  // Public probe: lets the result screen know whether the design demo numbers (82 / 54) may be shown.
  if (new URL(request.url).searchParams.get("probe") === "demo") {
    return NextResponse.json({ demo: isSwipeDemoMode() });
  }
  try {
    const token = await verifyRequestToken(request);
    await connectDb();
    const doc = await User.findOne({ firebaseUid: token.uid })
      .select("qualityScore counting checkReasons")
      .lean<{ qualityScore?: number; counting?: boolean; checkReasons?: string[] }>();
    if (!doc) return NextResponse.json({ error: "No profile yet.", code: "no_profile" }, { status: 404 });
    const score = doc.qualityScore ?? 0;
    return NextResponse.json({
      score,
      counting: isCounting(score),
      reasons: doc.checkReasons ?? [],
      // 0 with no reasons means the swiper has not taken the check yet.
      checked: score > 0 || (doc.checkReasons?.length ?? 0) > 0 || Boolean(doc.counting),
      threshold: QUALITY.countingScore,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof Error && error.message.startsWith("MONGODB_URI")) {
      return NextResponse.json({ error: error.message, code: "not_configured" }, { status: 503 });
    }
    console.error("practice status route", error);
    return NextResponse.json({ error: "Could not reach the database." }, { status: 500 });
  }
}
