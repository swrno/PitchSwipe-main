/** Static NEXT_PUBLIC_* references so Next inlines them into the client bundle. */
export function isFirebaseClientConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  );
}

export const CONFIG_NEEDED_MESSAGE =
  "Sign-in is not configured yet. Set the NEXT_PUBLIC_FIREBASE_* values in .env.local (see .env.example) and restart.";
