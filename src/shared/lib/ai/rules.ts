import { ai } from "./services";
import type { SourceFact, SourceTable } from "./services-ai";

/** A fact key part from a label: "Uttar Pradesh" becomes "uttar_pradesh". Safe inside a placeholder. */
export function factSlug(label: string): string {
  const s = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s || "x";
}

/** Builds the source table. Throws when a display does not show its value or a key repeats. */
export function buildFactTable(facts: SourceFact[]): SourceTable {
  return ai.createSourceTable(facts);
}

export type WordingCheck =
  | { ok: true; text: string; citedKeys: string[] }
  | { ok: false; stage: "draft" | "post_check"; problems: unknown };

/**
 * Rules 1 and 2 (spec 05 section 6.5) for any text the model writes.
 * The model may only write figures as {fact.key} placeholders for facts in `table`; a typed digit
 * is rejected. Code then fills each placeholder from the table and re-checks that every number in
 * the filled text is shown by a cited fact. Any failure hides the text; it is never "fixed".
 */
export function checkAndFill(wording: string, table: SourceTable, allowedKeys?: string[]): WordingCheck {
  const draft = ai.checkDraft(wording, table, allowedKeys);
  if (!draft.ok) return { ok: false, stage: "draft", problems: draft.problems };
  const citedKeys = [...new Set(ai.placeholderKeys(wording))];
  const text = ai.fillPlaceholders(wording, (k) => table.display(k)).trim();
  const filled = ai.checkFilled(text, table, citedKeys);
  if (!filled.ok) return { ok: false, stage: "post_check", problems: filled.problems };
  return { ok: true, text, citedKeys };
}
