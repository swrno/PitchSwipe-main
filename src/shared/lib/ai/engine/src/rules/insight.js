import { checkDraft, checkFilled } from './post-check.js';
import { fillPlaceholders, placeholderKeys } from './numbers.js';
import { TAGS, TAG_LABELS, THRESHOLDS } from './tagging.js';

const SHOWABLE = new Set([TAGS.RESULT, TAGS.LEAD, TAGS.LEADING]);

/**
 * Build one insight from a code-made draft and the model's wording.
 *
 * draft = {
 *   classification,   // output of classifyExperiment() or classifySegment()
 *   outline,          // what the insight is about, in words, no numbers (given to the model)
 *   facts: [key],     // facts the wording may cite
 *   sourceTemplate,   // code-written source line, e.g. "Source: {decks} · {swipers} swipers"
 * }
 * wordedText: the model's text, with {key} placeholders for every figure.
 *
 * Returns { ok: true, tag, tagLabel, groupSize, text, sourceLine } or { ok: false, stage, detail }.
 * A failed insight is hidden, never shown with a corrected number.
 */
export function buildInsight({ draft, table, wordedText }) {
  const fail = (stage, detail) => ({ ok: false, stage, detail });

  const cls = draft?.classification;
  if (!cls || !SHOWABLE.has(cls.tag)) {
    return fail('tag', `tag ${cls?.tag} cannot be shown as an insight`);
  }
  if (cls.tag === TAGS.LEAD && !(cls.groupSize >= THRESHOLDS.minGroupSize)) {
    return fail('tag', `lead group is under ${THRESHOLDS.minGroupSize} swipers`);
  }
  if (typeof wordedText !== 'string' || wordedText.trim() === '') {
    return fail('draft', 'empty wording');
  }

  const facts = draft.facts ?? [];
  if (facts.length === 0) return fail('facts', 'insight cites no facts');
  const sourceKeys = placeholderKeys(draft.sourceTemplate ?? '');
  const allowed = [...new Set([...facts, ...sourceKeys])];
  for (const k of allowed) {
    if (!table.has(k)) return fail('facts', `unknown fact ${k}`);
  }

  const draftCheck = checkDraft(wordedText, table, facts);
  if (!draftCheck.ok) return fail('draft', draftCheck.problems);

  const text = fillPlaceholders(wordedText, (k) => table.display(k)).trim();
  const textCheck = checkFilled(text, table, allowed);
  if (!textCheck.ok) return fail('post_check', textCheck.problems);

  const sourceLine = fillPlaceholders(draft.sourceTemplate ?? '', (k) => table.display(k));
  const sourceCheck = checkFilled(sourceLine, table, allowed);
  if (!sourceCheck.ok) return fail('post_check', sourceCheck.problems);

  return {
    ok: true,
    tag: cls.tag,
    tagLabel: TAG_LABELS[cls.tag],
    groupSize: cls.groupSize ?? null,
    text,
    sourceLine,
  };
}

/**
 * Enforce the page rules (§6.5 rule 5): every Result stays; at most `maxLeads`
 * Leads, ranked by group size. Failed insights are hidden with their reason.
 */
export function applyPageLimits(insights, { maxLeads = THRESHOLDS.maxLeadsPerPage } = {}) {
  const shown = [];
  const hidden = [];
  const leads = insights
    .filter((i) => i.ok && i.tag === TAGS.LEAD)
    .sort((a, b) => b.groupSize - a.groupSize);
  const keptLeads = new Set(leads.slice(0, maxLeads));

  for (const i of insights) {
    if (!i.ok) hidden.push({ reason: i.stage, detail: i.detail });
    else if (i.tag === TAGS.LEAD && !keptLeads.has(i)) hidden.push({ reason: 'page lead limit', insight: i });
    else shown.push(i);
  }
  return { shown, hidden };
}
