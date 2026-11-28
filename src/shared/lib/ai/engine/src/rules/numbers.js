// Number tokens, canonical form and placeholders.
// Shared by the source table, the post-check and the language-draft check so
// that every module agrees on what counts as "the same number".

const NUMBER_RE = /\d{1,2}:\d{2}(?!\d)|\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;
const PLACEHOLDER_RE = /\{([a-zA-Z][\w.]*)\}/g;

/** Canonical string for a number token: "1,600" -> "1600", "18.30" -> "18.3", "18:42" -> "18:42". */
export function canonicalize(token) {
  const s = String(token).trim().replace(/,/g, '');
  if (/^\d{1,2}:\d{2}$/.test(s)) return s;
  const n = Number(s);
  return Number.isFinite(n) ? String(n) : s;
}

/** Every number-looking token in text, with its raw form and canonical form. */
export function extractNumbers(text) {
  const out = [];
  for (const m of String(text).matchAll(NUMBER_RE)) {
    out.push({ raw: m[0], canonical: canonicalize(m[0]), index: m.index });
  }
  return out;
}

/** Keys of every {placeholder} in text, in order. */
export function placeholderKeys(text) {
  return [...String(text).matchAll(PLACEHOLDER_RE)].map((m) => m[1]);
}

/** Text with every {placeholder} removed, so only literal numbers remain to be checked. */
export function stripPlaceholders(text) {
  return String(text).replace(PLACEHOLDER_RE, ' ');
}

/** Replace every {key} with fn(key). */
export function fillPlaceholders(text, fn) {
  return String(text).replace(PLACEHOLDER_RE, (_, key) => fn(key));
}
