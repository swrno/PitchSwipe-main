import { wordingPrompt } from '../prompts/templates.js';
import { buildInsight } from '../rules/insight.js';

/**
 * Ask the model for wording, then run the rules. Returns the buildInsight result:
 * { ok: true, tag, tagLabel, text, sourceLine } or { ok: false, stage, detail }.
 * Used for results explainer (task 'results_explainer') and product insights ('product_insights').
 */
export async function writeInsight({ provider, task, draft, table }) {
  const { text: raw } = await provider.complete(wordingPrompt({ task, draft, table }));
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, stage: 'parse', detail: 'model did not return JSON' };
  }
  if (typeof parsed?.text !== 'string') {
    return { ok: false, stage: 'parse', detail: 'model JSON has no text field' };
  }
  return buildInsight({ draft, table, wordedText: parsed.text });
}
