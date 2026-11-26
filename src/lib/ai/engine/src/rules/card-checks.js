import { checkFilled } from './post-check.js';
import { createSourceTable } from './source-table.js';
import { extractNumbers } from './numbers.js';

/**
 * One-variable rule (spec 02 §5.1): every card in a deck must match on every field
 * except the variable under test. Deterministic, no model involved.
 */
export function checkDeckShape(cards, variableField) {
  const problems = [];
  if (!Array.isArray(cards) || cards.length < 2) {
    return { ok: false, problems: [{ type: 'too_few_cards' }] };
  }
  const keysOf = (c) => Object.keys(c).sort().join('|');
  const base = cards[0];
  for (const card of cards) {
    if (keysOf(card) !== keysOf(base)) problems.push({ type: 'different_fields', card: card.id });
    if (!(variableField in card)) problems.push({ type: 'missing_variable', card: card.id });
  }
  for (const field of Object.keys(base)) {
    if (field === variableField || field === 'id') continue;
    const reference = JSON.stringify(base[field]);
    for (const card of cards) {
      if (JSON.stringify(card[field]) !== reference) {
        problems.push({ type: 'locked_field_differs', field, card: card.id });
      }
    }
  }
  return { ok: problems.length === 0, problems };
}

/**
 * Language drafts must keep every figure of the source card, unchanged, in the same
 * set. Numbers are checked with the same canonical rules as insights.
 */
export function checkLanguageDraft(draftText, sourceText) {
  const sourceNumbers = extractNumbers(sourceText).map((n) => n.canonical);
  const table = createSourceTable(
    sourceNumbers.map((value, i) => ({ key: `src.n${i}`, value: Number(value) || value, display: String(value) })),
  );
  const keys = sourceNumbers.map((_, i) => `src.n${i}`);
  const fromSource = new Set(sourceNumbers);
  const inDraft = extractNumbers(draftText).map((n) => n.canonical);
  const missing = [...fromSource].filter((n) => !inDraft.includes(n));
  const extra = inDraft.filter((n) => !fromSource.has(n));
  const check = checkFilled(draftText, table, keys);
  const problems = [
    ...missing.map((n) => ({ type: 'figure_missing', value: n })),
    ...extra.map((n) => ({ type: 'figure_added', value: n })),
    ...check.problems,
  ];
  return { ok: problems.length === 0, problems };
}

/**
 * Theme counts come from code, never the model: the model groups comment ids,
 * code counts them and drops ids that are not in the comment list.
 */
export function applyThemeCounts(themes, comments) {
  const known = new Set((comments ?? []).map((c) => c.id));
  return (themes ?? [])
    .map((t) => {
      const ids = [...new Set(t.commentIds ?? [])].filter((id) => known.has(id));
      return { label: String(t.label), commentIds: ids, count: ids.length };
    })
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);
}
