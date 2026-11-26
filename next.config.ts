import type { NextConfig } from "next";

// `next dev` only: extra hosts allowed to load dev resources, e.g. a phone running the Android dev shell against
// this machine (NEXT_DEV_ALLOWED_ORIGINS=192.168.0.10). Comma separated. Ignored by production builds.
const devOrigins = (process.env.NEXT_DEV_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const isDev = process.env.NODE_ENV !== "production";

// Email/password sign-in only calls the two googleapis hosts in connect-src. On mobile browsers and Safari the
// Firebase SDK also loads gapi (apis.google.com) and a hidden iframe from the auth domain up front, so both are
// allowed. The auth domain may be a custom one, so the configured host is added next to *.firebaseapp.com.
function authDomainOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return url.protocol === "https:" && !url.hostname.endsWith(".firebaseapp.com") ? url.origin : null;
  } catch {
    return null;
  }
}
const customAuthDomain = authDomainOrigin();
const firebaseFrames = ["https://*.firebaseapp.com", ...(customAuthDomain ? [customAuthDomain] : [])];

/**
 * Content-Security-Policy for every route.
 *
 * script-src keeps 'unsafe-inline' on purpose. The App Router streams its RSC payload as inline
 * `self.__next_f.push(...)` scripts on every page, and the theme boot script in src/app/layout.tsx is inline as
 * well. A per-request nonce would need a proxy (middleware) on every page and would make every page dynamic.
 * Do NOT add a hash or nonce next to 'unsafe-inline': browsers then ignore 'unsafe-inline' and hydration breaks.
 * The rest still holds: no plugins, no framing, no foreign forms or base URLs, and fetch/frames only to the
 * listed hosts.
 *
 * style-src needs 'unsafe-inline' because server-rendered markup carries style="" attributes.
 * Dev only: 'unsafe-eval' (React dev tooling, Fast Refresh), ws:/wss: for the HMR socket, blob: workers.
 * No upgrade-insecure-requests: it would break http://localhost and the Android dev shell. nginx sends HSTS.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://apis.google.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  // Voice notes are recorded into blob: URLs and played back from them.
  "media-src 'self' blob:",
  [
    "connect-src 'self'",
    "https://identitytoolkit.googleapis.com",
    "https://securetoken.googleapis.com",
    "https://edge.api.flagsmith.com",
    "https://api.flagsmith.com",
    ...(isDev ? ["ws:", "wss:"] : []),
  ].join(" "),
  `frame-src 'self' ${firebaseFrames.join(" ")}`,
  `worker-src 'self'${isDev ? " blob:" : ""}`,
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Voice notes use the microphone on this origin only.
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
];

// Commit sha baked in at build time (deploy.yml sets GIT_SHA for the build step); /api/health reports it.
// Only set when present, so a build without it leaves GIT_SHA to the runtime environment.
const buildSha = process.env.GIT_SHA?.trim();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(devOrigins.length ? { allowedDevOrigins: devOrigins } : {}),
  ...(buildSha ? { env: { GIT_SHA: buildSha } } : {}),
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
