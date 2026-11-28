/** Domain and origin handling for registered sites. Pure. */

const HOST_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;

/**
 * "https://Voice-Khata.vercel.app/pricing?x=1" -> "voice-khata.vercel.app". Returns null for
 * anything that is not a plain hostname (spaces, credentials, empty).
 */
export function normalizeDomain(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let s = input.trim().toLowerCase();
  if (!s || s.length > 300) return null;
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  if (s.includes("@")) return null;
  s = s.split(/[/?#]/)[0] ?? "";
  s = s.replace(/:\d{1,5}$/, "").replace(/\.$/, "");
  if (s.startsWith("www.")) s = s.slice(4);
  return HOST_RE.test(s) ? s : null;
}

/** Hostname of an Origin header ("https://x.app" or "http://localhost:5173"), or null ("null", junk). */
export function originHost(origin: string | null | undefined): string | null {
  if (!origin) return null;
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** True when the request's Origin is the registered domain (or its www. form). Ports are ignored. */
export function originMatches(origin: string | null | undefined, domain: string): boolean {
  const host = originHost(origin);
  if (!host) return false;
  const d = domain.toLowerCase();
  return host === d || host === `www.${d}`;
}

/** CORS headers that allow exactly the registered site origin, or none. */
export function corsHeaders(origin: string | null | undefined, domain: string): Record<string, string> {
  if (!origin || !originMatches(origin, domain)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "600",
    vary: "Origin",
  };
}
