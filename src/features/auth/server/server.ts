import type { DecodedIdToken } from "firebase-admin/auth";
import { NOT_CONFIGURED_MESSAGE, isFirebaseAdminEnvSet } from "@/shared/lib/config";
import { getFirebaseAdminAuth } from "@/shared/lib/firebase/admin";

/** Server only. Thrown for any auth problem; carries the HTTP status to return. */
export class AuthError extends Error {
  constructor(
    message: string,
    public status: 401 | 503,
    public code: "unauthenticated" | "not_configured",
  ) {
    super(message);
  }
}

export const isFirebaseAdminConfigured = isFirebaseAdminEnvSet;

/** Verifies the `Authorization: Bearer <Firebase ID token>` header. Reusable by other route handlers. */
export async function verifyRequestToken(request: Request): Promise<DecodedIdToken> {
  if (!isFirebaseAdminConfigured()) {
    throw new AuthError(
      NOT_CONFIGURED_MESSAGE,
      503,
      "not_configured",
    );
  }
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer (.+)$/i.exec(header);
  if (!match) throw new AuthError("Sign in required.", 401, "unauthenticated");
  try {
    return await getFirebaseAdminAuth().verifyIdToken(match[1]);
  } catch {
    throw new AuthError("Your session has expired. Sign in again.", 401, "unauthenticated");
  }
}
