/**
 * Server configuration check (pure: safe to import anywhere on the server and in tests).
 * PitchSwipe has one mode: real storage (MongoDB) and real sign-in (Firebase). When either is missing, API routes
 * answer 503 with NOT_CONFIGURED_MESSAGE and pages show it. There is no fallback to sample data.
 */
export const NOT_CONFIGURED_MESSAGE = "Server not configured: set MONGODB_URI and the Firebase keys in .env";

/** True when the Firebase Admin credentials are all set. */
export function isFirebaseAdminEnvSet(): boolean {
  return Boolean(
    process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  );
}

/** True when MongoDB and Firebase Admin are both configured. */
export function isServerConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI) && isFirebaseAdminEnvSet();
}
