import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { normalizePrivateKey } from "./private-key";

/**
 * Firebase Admin SDK (server only). Verifies Firebase ID tokens in route handlers
 * and reads the verified email state. Never import this from client components.
 *
 * Nothing initialises at import time: call getFirebaseAdminAuth() inside a handler.
 */
function readAdminCredentials() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin config missing: set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY. See .env.example.",
    );
  }
  return { projectId, clientEmail, privateKey };
}

export function getFirebaseAdminApp(): App {
  return getApps().length > 0 ? getApp() : initializeApp({ credential: cert(readAdminCredentials()) });
}

export function getFirebaseAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}
