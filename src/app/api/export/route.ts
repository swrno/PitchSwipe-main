import { NextResponse } from "next/server";

import { verifyRequestToken } from "@/features/auth/server/server";
import { readJson, resolveOwnerId } from "@/features/decks/server/owner";
import { limitKey, limitRequest } from "@/shared/lib/ratelimit";
import { exportOptions, loadExportDecks } from "@/features/export/server/load";
import { buildExportPreview } from "@/features/export/preview";
import { mailerFromEnv } from "@/features/export/server/mailer";
import { parseExportRequest, runExport, type ExportRequest } from "@/features/export/server/service";

const NO_STORE = { "cache-control": "no-store" };

/** The signed-in founder's own address (never taken from the request). Null when there is none. */
async function founderEmail(request: Request): Promise<string | null> {
  try {
    const token = await verifyRequestToken(request);
    // Never mail files to an address the token has not verified.
    return token.email_verified === true ? (token.email ?? null) : null;
  } catch {
    return null;
  }
}

async function handle(request: Request, req: ExportRequest) {
  const early = limitRequest(request, "export:ip", { limit: 30, windowMs: 60_000 }, NO_STORE);
  if (early) return early;
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  // Building a zip/PDF is heavy and an email costs money: cap per founder.
  const limited =
    limitKey(`export:owner:${who.ownerId}`, { limit: 10, windowMs: 60_000 }, NO_STORE) ??
    (req.delivery === "email" ? limitKey(`export:email:${who.ownerId}`, { limit: 3, windowMs: 600_000 }, NO_STORE) : null);
  if (limited) return limited;
  try {
    const outcome = await runExport(who.ownerId, req, {
      load: loadExportDecks,
      mailer: mailerFromEnv(),
      founderEmail: req.delivery === "email" ? await founderEmail(request) : null,
    });
    if (outcome.kind === "error") return NextResponse.json({ error: outcome.error }, { status: outcome.status, headers: NO_STORE });
    if (outcome.kind === "emailed") return NextResponse.json({ emailed: true, to: outcome.to, files: outcome.files, stamp: outcome.stamp }, { headers: NO_STORE });
    const { bundle } = outcome;
    return new NextResponse(new Uint8Array(bundle.data), {
      headers: {
        ...NO_STORE,
        "content-type": bundle.contentType,
        "content-disposition": `attachment; filename="${bundle.name}"`,
        "x-export-files": bundle.files.join(","),
      },
    });
  } catch (error) {
    console.error("export: failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not make the files. Try again." }, { status: 500, headers: NO_STORE });
  }
}

/**
 * GET  /api/export?deckId=&scope=deck|product&files=report,summary,swipes,waitlist   download
 * GET  /api/export?deckId=&scope=&preview=1   first rows of each file (waitlist emails partly hidden)
 * GET  /api/export?deckId=&options=1   what the Download sheet needs (decks in the product, waitlist size)
 * POST /api/export { deckId, scope, files, delivery: "download" | "email" }
 *
 * Owner only. One output file is returned as is; several come as one .zip. "email" sends the zip to
 * the signed-in founder's own address and only when RESEND_API_KEY is set. Founders get aggregates:
 * no names, emails or IPs of swipers; emails only for explicit waitlist claimants.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("options")) {
    const early = limitRequest(request, "export:options", { limit: 60, windowMs: 60_000 }, NO_STORE);
    if (early) return early;
    const who = await resolveOwnerId(request);
    if ("response" in who) return who.response;
    const deckId = url.searchParams.get("deckId") ?? "";
    const opts = deckId ? await exportOptions(who.ownerId, deckId).catch(() => null) : null;
    if (!opts) return NextResponse.json({ error: "Test not found." }, { status: 404, headers: NO_STORE });
    return NextResponse.json({ ...opts, emailAvailable: Boolean(process.env.RESEND_API_KEY) }, { headers: NO_STORE });
  }
  if (url.searchParams.get("preview")) {
    const early = limitRequest(request, "export:preview", { limit: 30, windowMs: 60_000 }, NO_STORE);
    if (early) return early;
    const who = await resolveOwnerId(request);
    if ("response" in who) return who.response;
    const deckId = url.searchParams.get("deckId") ?? "";
    const scope = url.searchParams.get("scope") === "product" ? "product" : "deck";
    try {
      const decks = deckId ? await loadExportDecks(who.ownerId, deckId, scope, new Date()) : null;
      if (!decks || decks.length === 0) return NextResponse.json({ error: "Test not found." }, { status: 404, headers: NO_STORE });
      return NextResponse.json(buildExportPreview(decks, scope, new Date()), { headers: NO_STORE });
    } catch (error) {
      console.error("export: preview failed", error instanceof Error ? error.message : error);
      return NextResponse.json({ error: "Could not load the preview." }, { status: 500, headers: NO_STORE });
    }
  }
  const parsed = parseExportRequest({
    deckId: url.searchParams.get("deckId") ?? undefined,
    scope: url.searchParams.get("scope") ?? undefined,
    files: url.searchParams.get("files") ?? undefined,
    delivery: "download",
    format: url.searchParams.get("format") ?? undefined,
    theme: url.searchParams.get("theme") ?? undefined,
  });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  return handle(request, parsed.value);
}

export async function POST(request: Request) {
  const body = (await readJson(request)) as Record<string, unknown> | null;
  const parsed = parseExportRequest(body ?? {});
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  return handle(request, parsed.value);
}
