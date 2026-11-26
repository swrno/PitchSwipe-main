// Prompt templates for each AI service (spec 05 §6). Each returns { task, system, user, maxTokens }.
// Figures never appear in prompts: the model gets keys and labels, and writes {key} placeholders.

export const SYSTEM_RULES = [
  'You write for a founder testing pitch variants. Code fills every number; you never type one.',
  'Never write a digit or a number word for any figure. Refer to a figure only as a {key} placeholder from FACTS.',
  'Use only the outline and facts given. Do not add claims, rankings, comparisons or numbers.',
  'Never describe a Lead as a proven result. Never say winners from separate tests were tested together.',
  'Never claim an AI persona prediction is real evidence.',
].join('\n');

const json = (obj) => JSON.stringify(obj, null, 2);

/** 6.1.1 Three angles: problem-led, outcome-led, price-led cards that differ in substance. */
export function threeAnglesPrompt({ idea, product, targetRoles }) {
  return {
    task: 'three_angles',
    system: SYSTEM_RULES,
    user: json({
      instruction:
        'Write three pitch cards for one idea, one each: problem-led, outcome-led, price-led. They must differ in substance, not just wording. Plain words, no jargon.',
      idea,
      product,
      targetRoles,
      output: '{"angles":[{"angle":"problem|outcome|price","headline":"...","description":"..."}]}',
    }),
    maxTokens: 800,
  };
}

/** 6.1.2 Card checker: vague words, jargon, overly long pitches, near-duplicates. */
export function cardCheckPrompt({ cards }) {
  return {
    task: 'card_check',
    system: SYSTEM_RULES,
    user: json({
      instruction:
        'Flag vague words, jargon, overly long pitches and near-duplicate cards. Refer to cards by id only. Do not rewrite cards.',
      cards,
      output: '{"issues":[{"card":"id","kind":"vague|jargon|long|duplicate","message":"..."}]}',
    }),
    maxTokens: 800,
  };
}

/** Language drafts. Figures in the source card must be copied unchanged (checked by checkLanguageDraft). */
export function languageDraftPrompt({ card, language }) {
  return {
    task: 'language_draft',
    system: SYSTEM_RULES,
    user: json({
      instruction: `Translate this card into ${language}. Keep the meaning and tone. Copy every figure exactly as written.`,
      card,
      output: '{"text":"..."}',
    }),
    maxTokens: 600,
  };
}

/** Why people swiped: the model groups comment ids; code counts them (applyThemeCounts). */
export function swipeThemesPrompt({ card, comments }) {
  return {
    task: 'swipe_themes',
    system: SYSTEM_RULES,
    user: json({
      instruction:
        'Group these one-line comments into short themes. Use only comment ids given. Do not count comments.',
      card,
      comments: comments.map((c) => ({ id: c.id, text: c.englishText ?? c.text })),
      output: '{"themes":[{"label":"...","commentIds":["..."]}]}',
    }),
    maxTokens: 800,
  };
}

/** Persona pre-test. Output is Simulated and Unproven; it never enters insights or counts. */
export function personaPretestPrompt({ card, persona }) {
  return {
    task: 'persona_pretest',
    system: SYSTEM_RULES,
    user: json({
      instruction:
        'You are a simulated target user seeing only this one card. Pick nothing about other cards. Give a one-line reaction.',
      persona,
      card,
      output: '{"choice":"yes|no","reaction":"..."}',
    }),
    maxTokens: 200,
  };
}

/** Wording prompt shared by results explainer, product insights and any other code-drafted insight. */
export function wordingPrompt({ task, draft, table }) {
  const facts = (draft.facts ?? []).map((k) => ({ key: k, label: table.get(k).label }));
  return {
    task,
    system: SYSTEM_RULES,
    user: json({
      instruction:
        'Write one or two short plain-language sentences for the outline. Cite every figure with a {key} placeholder from FACTS.',
      kind: draft.classification?.tag,
      outline: draft.outline,
      facts,
      output: '{"text":"..."}',
    }),
    maxTokens: 400,
  };
}
