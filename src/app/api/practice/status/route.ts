import { NextResponse } from "next/server";
import { connectDb } from "@/shared/lib/db";
import { AuthError, verifyRequestToken } from "@/features/auth/server/server";
import { QUALITY, isCounting } from "@/features/quality";
import { isServerConfigured } from "@/shared/lib/config";
import { notConfiguredResponse } from "@/shared/lib/not-configured";
import { User } from "@/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/practice/status: the signed-in swiper's saved score, counting flag and reasons. */
export async function GET(request: Request) {
  if (!isServerConfigured()) return notConfiguredResponse();
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
      if (error.code === "not_configured") return notConfiguredResponse();
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("practice status route", error);
    return NextResponse.json({ error: "Could not reach the database." }, { status: 500 });
  }
}
