import { canonicalize, extractNumbers } from './numbers.js';

/**
 * The source table is the only place figures come from. Each fact has a key,
 * a machine value and the exact text the founder sees (display). A number may
 * appear in generated text only if it is shown by a fact the insight cites.
 *
 *   createSourceTable([{ key: 'deck1.chance', label: 'Headline test chance', value: 96, display: '96%' }])
 */
export function createSourceTable(entries) {
  const facts = new Map();

  for (const e of entries ?? []) {
    if (typeof e?.key !== 'string' || !/^[a-zA-Z][\w.]*$/.test(e.key)) {
      throw new TypeError(`bad fact key: ${e?.key}`);
    }
    if (facts.has(e.key)) throw new Error(`duplicate fact key: ${e.key}`);
    if (typeof e.display !== 'string' || e.display.length === 0) {
      throw new TypeError(`fact ${e.key} needs display text`);
    }
    const shown = extractNumbers(e.display).map((n) => n.canonical);
    // The value must be what the display shows, so the text can never drift from the data.
    if (!shown.includes(canonicalize(String(e.value)))) {
      throw new Error(`fact ${e.key}: display "${e.display}" does not show value ${e.value}`);
    }
    facts.set(e.key, {
      key: e.key,
      label: e.label ?? e.key,
      value: e.value,
      display: e.display,
      numbers: new Set(shown),
    });
  }

  function get(key) {
    const f = facts.get(key);
    if (!f) throw new Error(`unknown fact: ${key}`);
    return f;
  }

  return {
    has: (key) => facts.has(key),
    get,
    display: (key) => get(key).display,
    keys: () => [...facts.keys()],
    /** Canonical numbers allowed for the given keys (all facts when keys is omitted). */
    allowedNumbers(keys) {
      const allowed = new Set();
      for (const k of keys ?? facts.keys()) {
        for (const n of get(k).numbers) allowed.add(n);
      }
      return allowed;
    },
  };
}
