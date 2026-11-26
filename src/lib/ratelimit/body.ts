/**
 * Reads a request body with a hard byte cap, from the stream, without trusting Content-Length
 * (a chunked request has none). Stops reading and cancels the stream as soon as the cap is passed.
 */
export type CappedBody = { ok: true; bytes: Uint8Array } | { ok: false; reason: "too_large" | "unreadable" };

export async function readBodyCapped(request: Request, maxBytes: number): Promise<CappedBody> {
  const declared = Number(request.headers.get("content-length"));
  // A declared size over the cap is rejected early; a missing or false one is caught while streaming.
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, reason: "too_large" };
  if (!request.body) return { ok: true, bytes: new Uint8Array(0) };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.byteLength;
  }
  return { ok: true, bytes };
}
