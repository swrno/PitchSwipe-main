import { clientKey } from "@/lib/ratelimit";
import { readBodyCapped } from "@/lib/ratelimit/body";
import { handlePing, handlePreflight } from "@/lib/sites/service";
import { pingLimiters, siteDeps } from "@/lib/sites/server";

/**
 * POST /api/sites/ping?s=<siteId>: the snippet reports the elements it found and their text.
 * Public (no sign-in), so it is rate limited and CORS opens only for the registered site origin.
 * The body is sent as text/plain, which browsers allow without a preflight; OPTIONS is still answered.
 */
function reply(result: { status: number; headers: Record<string, string> }) {
  return new Response(null, { status: result.status, headers: { "cache-control": "no-store", ...result.headers } });
}

export async function OPTIONS(request: Request) {
  const url = new URL(request.url);
  try {
    return reply(await handlePreflight(await siteDeps(), { siteId: url.searchParams.get("s"), origin: request.headers.get("origin") }));
  } catch {
    return reply({ status: 500, headers: {} });
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  try {
    // Hard byte cap read from the stream (Content-Length is not trusted).
    const raw = await readBodyCapped(request, 8192);
    if (!raw.ok) return reply({ status: raw.reason === "too_large" ? 413 : 400, headers: {} });
    const body = new TextDecoder().decode(raw.bytes);
    return reply(
      await handlePing(await siteDeps(), pingLimiters(), {
        siteId: url.searchParams.get("s"),
        origin: request.headers.get("origin"),
        // SHA-256 of the caller's address, never the raw IP.
        ip: clientKey(request, "ping"),
        body,
      }),
    );
  } catch (error) {
    console.error("sites: ping failed", error instanceof Error ? error.message : error);
    return reply({ status: 500, headers: {} });
  }
}
