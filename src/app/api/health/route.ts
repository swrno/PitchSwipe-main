import { connectDb } from "@/shared/lib/db";
import { getFirebaseAdminApp } from "@/shared/lib/firebase/admin";

export const dynamic = "force-dynamic";

const DB_TIMEOUT_MS = 2000;

type DbState = "up" | "down" | "off";

/** Connects (or reuses the connection) and pings, giving up after 2 s. Never throws. */
async function pingDb(): Promise<DbState> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const attempt = (async () => {
    const conn = await connectDb();
    const db = conn.connection.db;
    if (!db) throw new Error("no db handle");
    await db.admin().ping();
  })();
  // A late rejection from the losing attempt must not become an unhandled rejection.
  attempt.catch(() => undefined);
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), DB_TIMEOUT_MS);
  });
  try {
    await Promise.race([attempt, timeout]);
    return "up";
  } catch {
    return "down";
  } finally {
    clearTimeout(timer);
  }
}

/** True when the Firebase Admin credentials are present and parse. No network call. */
function firebaseAdminReady(): boolean {
  try {
    getFirebaseAdminApp();
    return true;
  } catch {
    return false;
  }
}

/**
 * Liveness and configuration check for the deploy script and uptime monitors. No auth, never cached.
 *
 * ok is false (HTTP 503) when the app cannot serve real data: the database is down, there is no MONGODB_URI (every
 * data route answers 503 then), or the Firebase Admin credentials are missing or unparseable (every token-checked
 * route fails then). Only states are returned, never error messages, hosts or keys.
 */
export async function GET() {
  const db: DbState = !process.env.MONGODB_URI ? "off" : await pingDb();
  const firebaseAdmin = firebaseAdminReady();
  // Both are needed: without parseable Admin credentials every token-checked route fails.
  const ok = db === "up" && firebaseAdmin;
  const version = process.env.GIT_SHA?.trim() || process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null;

  return Response.json(
    { ok, db, firebaseAdmin, version },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
