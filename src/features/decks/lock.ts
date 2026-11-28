/**
 * Locked-fields enforcement (spec/02 §5.1: one variable per deck, everything
 * else identical, "no editing cards after the experiment starts").
 *
 * Pure functions. The API routes call these before every write, so the rule
 * holds no matter what the browser sends.
 */
import type { DeckStatus } from "@/types";
import type { DeckInput, DeckRecord, FieldError } from "./types";

/** Everything that defines the cards. Frozen as soon as the deck leaves "draft". */
export const CONTENT_KEYS = [
  "variable",
  "priceMode",
  "cards",
  "shared",
  "question",
  "positiveLabel",
  "negativeLabel",
] as const;
export type ContentKey = (typeof CONTENT_KEYS)[number];

/** Housekeeping fields that may change on a live deck (moving or archiving it). */
export const HOUSEKEEPING_KEYS = ["productId", "archived"] as const;

export const PATCH_KEYS: readonly string[] = [...CONTENT_KEYS, ...HOUSEKEEPING_KEYS, "publish"];

/** Cards are editable only while the deck is a draft. */
export function isContentEditable(status: DeckStatus): boolean {
  return status === "draft";
}

export function canPublish(status: DeckStatus): boolean {
  return status === "draft";
}

/** Only drafts can be deleted; started tests are kept (results, waitlist). */
export function canDelete(status: DeckStatus): boolean {
  return status === "draft";
}

export function canArchive(status: DeckStatus): boolean {
  return status !== "closed";
}

/** Drops the server-written product snapshot so it never counts as a change. */
function withoutSnapshot(value: unknown): unknown {
  if (typeof value === "object" && value !== null && !Array.isArray(value) && "product" in value) {
    const { product: _product, ...rest } = value as Record<string, unknown>;
    void _product;
    return rest;
  }
  return value;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(withoutSnapshot(a) ?? null) === JSON.stringify(withoutSnapshot(b) ?? null);
}

export interface PatchCheck {
  ok: boolean;
  violations: FieldError[];
}

/**
 * Checks a PATCH body against the stored deck. Unknown keys are rejected.
 * For a non-draft deck any content key that differs from what is stored is a
 * violation; sending the identical value is harmless and allowed.
 */
export function checkDeckPatch(existing: Pick<DeckRecord, "status"> & Partial<DeckInput>, patch: Record<string, unknown>): PatchCheck {
  const violations: FieldError[] = [];
  for (const key of Object.keys(patch)) {
    if (!PATCH_KEYS.includes(key)) violations.push({ path: key, message: `"${key}" cannot be changed.` });
  }
  if (!isContentEditable(existing.status)) {
    for (const key of CONTENT_KEYS) {
      if (key in patch && !deepEqual(patch[key], (existing as Record<string, unknown>)[key])) {
        violations.push({
          path: key,
          message: "Cards are locked once the deck is published. Start a new deck to test a change.",
        });
      }
    }
    if (patch.publish) violations.push({ path: "publish", message: "This deck is already published." });
  }
  return { ok: violations.length === 0, violations };
}

/** The deck as the validator sees it after applying a patch to a draft. */
export function applyDraftPatch(existing: DeckInput, patch: Partial<DeckInput>): DeckInput {
  const next: DeckInput = { ...existing };
  for (const key of CONTENT_KEYS) {
    if (key in patch) (next as unknown as Record<string, unknown>)[key] = (patch as Record<string, unknown>)[key];
  }
  if (patch.productId) next.productId = patch.productId;
  // Switching the variable resets what belonged to the old one.
  if (patch.variable && patch.variable !== existing.variable) {
    if (!("cards" in patch)) next.cards = [];
    if (!("priceMode" in patch) && patch.variable !== "price") delete next.priceMode;
  }
  return next;
}

/** Rows for the "Same on every card" list on the New deck screen. */
export function lockedRows(input: Pick<DeckInput, "variable" | "shared" | "question" | "positiveLabel" | "negativeLabel">): { key: string; label: string; value: string }[] {
  const rows: { key: string; label: string; value: string }[] = [];
  const s = input.shared;
  const push = (key: string, label: string, value: string | undefined) => value && rows.push({ key, label, value });
  push("headline", "Headline", s.headline);
  push("description", "Description", s.description);
  push("reward", "Launch reward", s.reward);
  push("price", "Price", s.price);
  push("question", "Question", input.variable === "language" ? undefined : input.question);
  if (input.variable !== "language") push("answers", "Answers", `${input.positiveLabel} / ${input.negativeLabel}`);
  if (s.productUI?.length) push("productUI", "Product UI", `${s.productUI.length} screenshot${s.productUI.length === 1 ? "" : "s"}`);
  if (s.logo) push("logo", "Logo", s.logo.name);
  return rows;
}
