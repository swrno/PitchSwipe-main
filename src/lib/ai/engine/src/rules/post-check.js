import { extractNumbers, placeholderKeys, stripPlaceholders } from './numbers.js';

/**
 * Check the model's draft BEFORE filling it. The model may refer to figures only
 * through {key} placeholders, and only through facts this insight cites.
 * Any literal figure it types is rejected (rule 1: numbers never come from the model).
 */
export function checkDraft(draftText, table, allowedKeys) {
  const problems = [];
  for (const key of placeholderKeys(draftText)) {
    if (!table.has(key)) problems.push({ type: 'unknown_fact', key });
    else if (allowedKeys && !allowedKeys.includes(key)) {
      problems.push({ type: 'fact_not_cited', key });
    }
  }
  for (const n of extractNumbers(stripPlaceholders(draftText))) {
    problems.push({ type: 'literal_number', raw: n.raw });
  }
  return { ok: problems.length === 0, problems };
}

/**
 * Check the filled text: every number in it must be shown by an allowed fact.
 * Rule 2: any mismatch (rounded, invented or misattributed figure) fails the check.
 */
export function checkFilled(text, table, allowedKeys) {
  const allowed = table.allowedNumbers(allowedKeys);
  const problems = extractNumbers(text)
    .filter((n) => !allowed.has(n.canonical))
    .map((n) => ({ type: 'number_not_in_source', raw: n.raw }));
  return { ok: problems.length === 0, problems };
}
