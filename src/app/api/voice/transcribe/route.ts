import { AuthError, verifyRequestToken } from "@/lib/auth/server";
import { handleVoiceText, translateProviderFromEnv, type VerifyResult } from "@/lib/claims/voice-text";

export const runtime = "nodejs";

async function verify(request: Request): Promise<VerifyResult> {
  try {
    const token = await verifyRequestToken(request);
    return { ok: true, uid: token.uid, emailVerified: token.email_verified === true };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, status: error.status, code: error.code, error: error.message };
    return { ok: false, status: 401, code: "unauthenticated", error: "Sign in required." };
  }
}

/**
 * POST /api/voice/transcribe with `Authorization: Bearer <Firebase ID token>` and a JSON body
 * { text, languageCode, durationSec, swiperGuid }. The browser already turned the speech into text; this returns
 * { transcript, english, language } for the swiper to review. Nothing is stored here.
 *
 * English passes straight through. Other languages are translated by Claude (LLM_API_KEY, optional
 * LLM_TRANSLATE_MODEL) and the translation must keep every figure; without a key, or when a check fails, english is
 * "" and the swiper types it. Signed-in verified email only, rate limited per IP and per user, body capped.
 * See src/lib/claims/voice-text.ts.
 */
export async function POST(request: Request) {
  return handleVoiceText(request, { verify, provider: () => translateProviderFromEnv(process.env) });
}
