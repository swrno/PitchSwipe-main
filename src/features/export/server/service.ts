/**
 * Request handling for /api/export, free of Next.js so it can be unit tested with injected
 * loaders and mailer. The route handler adds the sign-in check (resolveOwnerId).
 */
import { bundleExport, type ExportBundle } from "../bundle";
import { emailMessage, MailerError, type Mailer } from "./mailer";
import { stampLabel } from "../stamp";
import { EXPORT_FILES, EXPORT_SCOPES, type ExportDeckData, type ExportFile, type ExportScope } from "../types";

export type ExportDelivery = "download" | "email";

export interface ExportRequest {
  deckId: string;
  scope: ExportScope;
  files: ExportFile[];
  delivery: ExportDelivery;
}

export type ParseResult = { ok: true; value: ExportRequest } | { ok: false; error: string };

/** Accepts query strings (`files=report,summary`) and JSON bodies (`files: ["report"]`). */
export function parseExportRequest(raw: { deckId?: unknown; scope?: unknown; files?: unknown; delivery?: unknown }): ParseResult {
  const deckId = typeof raw.deckId === "string" ? raw.deckId.trim() : "";
  if (!deckId) return { ok: false, error: "Pick a test to export." };
  const scope = raw.scope === undefined || raw.scope === "" ? "deck" : raw.scope;
  if (!EXPORT_SCOPES.includes(scope as ExportScope)) return { ok: false, error: "Scope must be test or product." };
  const list = Array.isArray(raw.files) ? raw.files : typeof raw.files === "string" ? raw.files.split(",") : [];
  const files = [...new Set(list.map((f) => String(f).trim()).filter(Boolean))];
  if (files.length === 0) return { ok: false, error: "Pick at least one file." };
  const bad = files.find((f) => !EXPORT_FILES.includes(f as ExportFile));
  if (bad) return { ok: false, error: `Unknown file: ${bad.slice(0, 30)}.` };
  const delivery = raw.delivery === undefined || raw.delivery === "" ? "download" : raw.delivery;
  if (delivery !== "download" && delivery !== "email") return { ok: false, error: "Delivery must be download or email." };
  return { ok: true, value: { deckId, scope: scope as ExportScope, files: files as ExportFile[], delivery } };
}

export interface ExportDeps {
  load: (ownerId: string, deckId: string, scope: ExportScope, now: Date) => Promise<ExportDeckData[] | null>;
  /** Null when email is not configured (no RESEND_API_KEY). */
  mailer: Mailer | null;
  /** The signed-in founder's own address. Email is only ever sent here, never to an address the client supplies. */
  founderEmail: string | null;
  now?: Date;
}

export type ExportOutcome =
  | { kind: "download"; bundle: ExportBundle }
  | { kind: "emailed"; to: string; files: string[]; stamp: string }
  | { kind: "error"; status: number; error: string };

/** "a***@example.com" so the response never echoes a full address back. */
export function maskEmail(email: string): string {
  const [name, domain = ""] = email.split("@");
  return `${name.slice(0, 1)}***@${domain}`;
}

export async function runExport(ownerId: string, req: ExportRequest, deps: ExportDeps): Promise<ExportOutcome> {
  if (req.delivery === "email") {
    if (!deps.mailer) {
      return { kind: "error", status: 503, error: "Email is not set up yet. Download the files instead." };
    }
    if (!deps.founderEmail) return { kind: "error", status: 400, error: "There is no email address on your account. Download the files instead." };
  }
  const now = deps.now ?? new Date();
  const decks = await deps.load(ownerId, req.deckId, req.scope, now);
  if (!decks || decks.length === 0) return { kind: "error", status: 404, error: "Test not found." };

  const bundle = bundleExport(
    { productName: decks[0].payload.deck.productName, scope: req.scope, decks, files: req.files, now },
    { forceZip: req.delivery === "email" },
  );
  if (req.delivery === "download") return { kind: "download", bundle };

  const stamp = stampLabel(now);
  try {
    await (deps.mailer as Mailer).send(emailMessage(deps.founderEmail as string, bundle, stamp));
  } catch (error) {
    if (error instanceof MailerError) return { kind: "error", status: 502, error: error.message };
    throw error;
  }
  return { kind: "emailed", to: maskEmail(deps.founderEmail as string), files: bundle.files, stamp };
}
