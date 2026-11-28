"use client";

import * as React from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type ActionCodeSettings,
  type User as FirebaseUser,
} from "firebase/auth";
import { getFirebaseClientAuth } from "@/shared/lib/firebase/client";
import { CONFIG_NEEDED_MESSAGE, isFirebaseClientConfigured } from "../config";
import { explicitNext, withNext } from "../next";
import type { Industry, Role, State } from "@/shared/lib/lists";

export interface ProfileInput {
  name?: string;
  role?: Role;
  state?: State;
  interests?: Industry[];
}

export interface ProfileDoc {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role?: Role;
  state?: State;
  interests: Industry[];
  counting: boolean;
}

/** "ok": a profile exists. "missing": GET /api/profile said 404 no_profile. "unknown": anything else (offline, 5xx). */
export type ProfileStatus = "ok" | "missing" | "unknown";

/** An error whose message we wrote for people to read. authErrorMessage() shows it as is. */
export class AuthFlowError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "AuthFlowError";
  }
}

/** A non-2xx answer from /api/profile. Only 400/409 carry copy meant for people; the rest stay in the console. */
export class ProfileApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ProfileApiError";
  }
}

/**
 * signUp() created the Firebase account but could not save the profile. `reason` is the ProfileApiError (or network
 * error) behind it; the sign-up form branches on it (finish on /profile, carry on to /verify, or explain).
 */
export class ProfileSaveError extends Error {
  constructor(public reason: unknown) {
    super("Your account was created, but your profile was not saved.");
    this.name = "ProfileSaveError";
  }
}

/** Shown to people whenever sign-in cannot work (missing config, Firebase project problems). Details go to the console. */
export const SIGN_IN_UNAVAILABLE = "Sign-in is not available right now. Try again in a little while.";

interface AuthContextValue {
  configured: boolean;
  loading: boolean;
  user: FirebaseUser | null;
  /** `next`: where the verification link should continue to (kept through the email). */
  signUp(email: string, password: string, profile: ProfileInput & { name: string }, next?: string | null): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  resendVerification(next?: string | null): Promise<void>;
  /** Reloads Firebase state and, when verified, refreshes the ID token so the API sees email_verified. Returns the flag. */
  refreshVerification(): Promise<boolean>;
  /** Reloads the signed-in user from Firebase (emailVerified etc.) and re-renders consumers. Returns emailVerified. */
  reloadUser(): Promise<boolean>;
  /**
   * Sends a password reset email. Resolves the same whether or not an account exists for that email. The email's
   * continue link returns to /login, carrying `next` when it is a safe same-site path (contract C1).
   */
  sendReset(email: string, next?: string | null): Promise<void>;
  /** GET /api/profile without throwing: does the signed-in user have a profile? (The route also mirrors emailVerified.) */
  profileStatus(): Promise<ProfileStatus>;
  /** Authenticated fetch against our API (adds the Firebase ID token). */
  authFetch(input: string, init?: RequestInit): Promise<Response>;
  /** POST /api/profile (partial updates allowed once the profile exists). */
  saveProfile(profile: ProfileInput): Promise<ProfileDoc>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

/** Base URL for links in Firebase emails: NEXT_PUBLIC_APP_URL when set, else wherever the page is served from. */
export function appUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  const base =
    configured && /^https?:\/\//.test(configured) ? configured : typeof window !== "undefined" ? window.location.origin : "";
  return base.replace(/\/+$/, "");
}

function continueSettings(path: string): ActionCodeSettings | undefined {
  const base = appUrl();
  return base ? { url: `${base}${path}` } : undefined;
}

/** Firebase refuses a continue URL whose domain is not in Authorized domains. Then send the plain email, not nothing. */
function isContinueUrlError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return code === "auth/unauthorized-continue-uri" || code === "auth/invalid-continue-uri" || code === "auth/missing-continue-uri";
}

async function withContinueFallback(send: (settings?: ActionCodeSettings) => Promise<void>, path: string) {
  try {
    await send(continueSettings(path));
  } catch (error) {
    if (!isContinueUrlError(error)) throw error;
    console.warn(
      `[auth] Firebase refused the continue URL for ${path}. Add the app domain to Firebase Auth > Authorized domains. Sending without it.`,
      error,
    );
    await send(undefined);
  }
}

let warnedNotConfigured = false;
/** Config details are for developers: console only, once per page load. */
function warnNotConfigured() {
  if (warnedNotConfigured) return;
  warnedNotConfigured = true;
  console.warn(`[auth] ${CONFIG_NEEDED_MESSAGE}`);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isFirebaseClientConfigured();
  const [user, setUser] = React.useState<FirebaseUser | null>(null);
  const [loading, setLoading] = React.useState(configured);
  // Bumped after user.reload(): Firebase mutates the same User object, so consumers need a new context value.
  const [revision, setRevision] = React.useState(0);

  React.useEffect(() => {
    if (!configured) {
      warnNotConfigured();
      return;
    }
    return onAuthStateChanged(getFirebaseClientAuth(), (next) => {
      setUser(next);
      setLoading(false);
    });
  }, [configured]);

  const value = React.useMemo<AuthContextValue>(() => {
    void revision;
    const requireConfigured = () => {
      if (!configured) {
        warnNotConfigured();
        throw new AuthFlowError(SIGN_IN_UNAVAILABLE, "app/not-configured");
      }
    };

    const currentUser = () => {
      requireConfigured();
      const current = getFirebaseClientAuth().currentUser;
      if (!current) throw new AuthFlowError("Sign in to continue.", "app/signed-out");
      return current;
    };

    const authFetch: AuthContextValue["authFetch"] = async (input, init = {}) => {
      const token = await currentUser().getIdToken();
      const headers = new Headers(init.headers);
      headers.set("authorization", `Bearer ${token}`);
      if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
      return fetch(input, { ...init, headers });
    };

    const saveProfile: AuthContextValue["saveProfile"] = async (profile) => {
      const res = await authFetch("/api/profile", { method: "POST", body: JSON.stringify(profile) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ProfileApiError(
          typeof data.error === "string" ? data.error : "Could not save your profile.",
          res.status,
          typeof data.code === "string" ? data.code : undefined,
        );
      }
      return data.user as ProfileDoc;
    };

    // The email's Continue link returns to /verify with the same `next`, so a founder who signed up from
    // "Test an idea" continues to /decks/new after verifying (not the swiper default).
    const sendVerification = (target: FirebaseUser, next?: string | null) =>
      withContinueFallback((settings) => sendEmailVerification(target, settings ?? null), withNext("/verify", explicitNext(next)));

    return {
      configured,
      loading,
      user,
      authFetch,
      saveProfile,
      async signUp(email, password, profile, next) {
        requireConfigured();
        const auth = getFirebaseClientAuth();
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        // From here the account exists: nothing below may leave the user at a dead end.
        try {
          await updateProfile(cred.user, { displayName: profile.name });
        } catch (error) {
          console.warn("[auth] Could not set the display name.", error);
        }
        let saveError: unknown = null;
        try {
          await saveProfile(profile);
        } catch (error) {
          console.error("[auth] Account created but the profile was not saved.", error);
          saveError = error;
        }
        // The verify page has a resend button, so a failed send is not fatal.
        await sendVerification(cred.user, next).catch((e) => console.warn("[auth] Verification email not sent.", e));
        if (saveError) throw new ProfileSaveError(saveError);
      },
      async signIn(email, password) {
        requireConfigured();
        await signInWithEmailAndPassword(getFirebaseClientAuth(), email, password);
      },
      async signOut() {
        if (configured) await firebaseSignOut(getFirebaseClientAuth());
      },
      async resendVerification(next) {
        await sendVerification(currentUser(), next);
      },
      async reloadUser() {
        const current = currentUser();
        await current.reload();
        setRevision((r) => r + 1);
        return current.emailVerified;
      },
      async refreshVerification() {
        const current = currentUser();
        await current.reload();
        setRevision((r) => r + 1);
        if (!current.emailVerified) return false;
        await current.getIdToken(true); // fresh token carries email_verified = true; GET /api/profile mirrors it
        return true;
      },
      async sendReset(email, next) {
        requireConfigured();
        const auth = getFirebaseClientAuth();
        const loginPath = withNext("/login", explicitNext(next));
        try {
          await withContinueFallback((settings) => sendPasswordResetEmail(auth, email, settings), loginPath);
        } catch (error) {
          // Never reveal whether an account exists.
          if ((error as { code?: string })?.code === "auth/user-not-found") return;
          throw error;
        }
      },
      async profileStatus() {
        try {
          const res = await authFetch("/api/profile");
          if (res.ok) return "ok";
          const data = await res.json().catch(() => ({}));
          if (res.status === 404 && data?.code === "no_profile") return "missing";
          console.warn("[auth] Profile check failed.", res.status, data);
          return "unknown";
        } catch (error) {
          console.warn("[auth] Profile check failed.", error);
          return "unknown";
        }
      },
    };
  }, [configured, loading, user, revision]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}

const GENERIC = "Something went wrong. Try again.";

/**
 * Maps errors to plain messages for people. Firebase codes get friendly copy; messages we wrote ourselves pass
 * through; everything else (raw Firebase strings, config details, server internals) is logged, never shown.
 */
export function authErrorMessage(error: unknown): string {
  if (error instanceof AuthFlowError) return error.message;
  if (error instanceof ProfileSaveError) return error.message;
  if (error instanceof ProfileApiError) {
    if (error.status === 400 || error.status === 409) return error.message;
    console.error("[auth] Profile API error", error.status, error.code, error.message);
    if (error.status === 401) return "Your session has expired. Sign in again.";
    if (error.status === 403 && error.code === "unverified") return "Verify your email first.";
    if (error.status === 429) return "Too many tries. Wait a few minutes and try again.";
    return "We could not reach PitchSwipe just now. Try again in a minute.";
  }
  const code = (error as { code?: string })?.code;
  switch (code) {
    case "auth/email-already-in-use":
      return "That email already has an account. Sign in instead.";
    case "auth/invalid-email":
    case "auth/missing-email":
      return "Enter a valid email address.";
    case "auth/missing-password":
      return "Enter your password.";
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements":
      return "Use a stronger password: at least 6 characters.";
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email and password do not match an account.";
    case "auth/user-disabled":
      return "This account has been turned off.";
    case "auth/too-many-requests":
    case "auth/quota-exceeded":
      return "Too many tries. Wait a few minutes and try again.";
    case "auth/network-request-failed":
    case "auth/timeout":
      return "Network problem. Check your connection and try again.";
    case "auth/expired-action-code":
    case "auth/invalid-action-code":
      return "That link has expired or was already used. Ask for a new one.";
    case "auth/requires-recent-login":
    case "auth/user-token-expired":
      return "Your session has expired. Sign in again.";
    case "auth/operation-not-allowed":
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid":
    case "auth/app-not-authorized":
    case "auth/unauthorized-domain":
    case "auth/configuration-not-found":
    case "auth/admin-restricted-operation":
    case "auth/internal-error":
      console.error("[auth] Firebase configuration problem", error);
      return SIGN_IN_UNAVAILABLE;
  }
  console.error("[auth] Unexpected error", error);
  return GENERIC;
}
