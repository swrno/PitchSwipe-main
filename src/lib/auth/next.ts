/**
 * Contract C1: `?next=` only ever points back into this site. A value is accepted when it is a same-site relative
 * path: it starts with a single "/", the second character is not "/" or "\", and it holds no backslash, control
 * character or whitespace. Anything else (absolute URLs, protocol-relative "//host", "/\host", "javascript:",
 * arrays, empty values) falls back to `fallback` (default /swipe).
 *
 * Safe to import from client and server code. Re-run it at every hop: never trust a `next` because an earlier page
 * already checked it.
 */
export const DEFAULT_NEXT = "/swipe";

// Control characters (C0, DEL, C1) and any whitespace. Browsers strip tabs/newlines inside URLs, so "/\t/evil.com"
// would turn into "//evil.com"; rejecting them outright closes that door.
const UNSAFE_CHAR = /[\u0000-\u001f\u007f-\u009f\s\\]/;

export function isSafeNext(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  if (raw.length === 0 || raw.length > 2048) return false;
  if (!raw.startsWith("/")) return false;
  if (raw.startsWith("//")) return false;
  if (UNSAFE_CHAR.test(raw)) return false;
  // Belt and braces: resolve against a dummy origin and make sure it stays there.
  try {
    const url = new URL(raw, "https://pitchswipe.invalid");
    if (url.origin !== "https://pitchswipe.invalid") return false;
  } catch {
    return false;
  }
  return true;
}

/** The safe `next` path, or `fallback` when the value is missing or not allowed. */
export function safeNext(raw: unknown, fallback: string = DEFAULT_NEXT): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return isSafeNext(value) ? value : fallback;
}

/** The safe `next` path when one was given explicitly, otherwise null (so the caller can keep its own default). */
export function explicitNext(raw: unknown): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return isSafeNext(value) ? value : null;
}

/** `path` with `?next=<next>` appended (or `&next=` when `path` already has a query). No `next` when it is null. */
export function withNext(path: string, next: string | null | undefined): string {
  if (!next) return path;
  return `${path}${path.includes("?") ? "&" : "?"}next=${encodeURIComponent(next)}`;
}
