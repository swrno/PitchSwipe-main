import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMockProvider,
  createLlmProviderFromEnv,
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_URL,
  writeInsight,
  createSourceTable,
  checkLanguageDraft,
  applyThemeCounts,
  threeAnglesPrompt,
  cardCheckPrompt,
  languageDraftPrompt,
  swipeThemesPrompt,
  personaPretestPrompt,
  wordingPrompt,
  classifyExperiment,
  countFact,
  chanceFact,
  TAGS,
} from '../src/index.js';
import { HEADLINE_DECIDED } from '../fixtures/voice-khata.js';

// ---- providers ---------------------------------------------------------------

test('mock provider is deterministic and records calls', async () => {
  const p = createMockProvider();
  const req = threeAnglesPrompt({ idea: 'Ledger for shops', product: 'Voice Khata' });
  const a = await p.complete(req);
  const b = await p.complete(req);
  assert.equal(a.text, b.text);
  assert.equal(p.calls.length, 2);
  const angles = JSON.parse(a.text).angles.map((x) => x.angle);
  assert.deepEqual(angles, ['problem', 'outcome', 'price']);
  assert.doesNotMatch(a.text, /\d/); // no figures from the model
});

test('mock provider accepts per-task overrides and rejects unknown tasks', async () => {
  const p = createMockProvider({ responses: { card_check: () => '{"issues":[]}' } });
  assert.equal((await p.complete({ task: 'card_check' })).text, '{"issues":[]}');
  await assert.rejects(p.complete({ task: 'unknown_task' }), /no answer/);
});

test('env provider refuses to start without LLM_API_KEY', () => {
  assert.throws(() => createLlmProviderFromEnv({}), /LLM_API_KEY is not set/);
});

test('env provider sends the key from env and joins text blocks, with a fake fetch', async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: 'text', text: 'Hello ' }, { type: 'text', text: 'world' }] }),
    };
  };
  const p = createLlmProviderFromEnv({ LLM_API_KEY: 'test-key-not-real' }, { fetchImpl: fakeFetch });
  const r = await p.complete({ system: 's', user: 'u' });
  assert.equal(r.text, 'Hello world');
  assert.equal(r.model, DEFAULT_LLM_MODEL);
  assert.equal(calls[0].url, DEFAULT_LLM_URL);
  assert.equal(calls[0].init.headers['x-api-key'], 'test-key-not-real');
});

test('env provider error does not leak the key', async () => {
  const fakeFetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
  const p = createLlmProviderFromEnv({ LLM_API_KEY: 'secret-value-123' }, { fetchImpl: fakeFetch });
  await assert.rejects(p.complete({ system: '', user: '' }), (err) => {
    assert.match(err.message, /status 401/);
    assert.doesNotMatch(err.message, /secret-value-123/);
    return true;
  });
});

// ---- prompts -----------------------------------------------------------------

test('every prompt template returns task, system rules and user payload', () => {
  const prompts = [
    threeAnglesPrompt({ idea: 'x', product: 'y' }),
    cardCheckPrompt({ cards: [] }),
    languageDraftPrompt({ card: {}, language: 'Hindi' }),
    swipeThemesPrompt({ card: {}, comments: [] }),
    personaPretestPrompt({ card: {}, persona: {} }),
  ];
  for (const p of prompts) {
    assert.ok(p.task);
    assert.match(p.system, /Never write a digit/);
    assert.ok(p.user.length > 0);
  }
});

test('wording prompt sends keys and labels but no figures', () => {
  const table = createSourceTable([
    countFact('swipers', 'swipers', 438, 'swipers'),
    chanceFact('deck1.chance', 'Headline test chance', 96),
  ]);
  const draft = {
    classification: { tag: TAGS.RESULT },
    outline: 'Buyers respond to the payment benefit.',
    facts: ['deck1.chance', 'swipers'],
  };
  const p = wordingPrompt({ task: 'results_explainer', draft, table });
  assert.match(p.user, /deck1\.chance/);
  assert.doesNotMatch(p.user, /96|438/);
});

test('language draft check: figures must match the source card exactly', () => {
  const source = 'Would you pay Rs 299 a month? Get 3 months free.';
  assert.equal(checkLanguageDraft('क्या आप Rs 299 देंगे? 3 महीने मुफ़्त।', source).ok, true);
  assert.equal(checkLanguageDraft('क्या आप Rs 199 देंगे? 3 महीने मुफ़्त।', source).ok, false);
  assert.equal(checkLanguageDraft('क्या आप Rs 299 देंगे?', source).ok, false); // missing 3
});

test('theme counts come from code and drop unknown comment ids', () => {
  const comments = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }];
  const themes = applyThemeCounts(
    [
      { label: 'Price', commentIds: ['c1', 'c2', 'zz'] },
      { label: 'Clarity', commentIds: ['c3', 'c3'] },
      { label: 'Ghost', commentIds: ['nope'] },
    ],
    comments,
  );
  assert.deepEqual(themes.map((t) => [t.label, t.count]), [['Price', 2], ['Clarity', 1]]);
});

// ---- insight service end to end with the mock --------------------------------

const TABLE = createSourceTable([
  countFact('decks', 'decks', 2, 'decks'),
  countFact('swipers', 'swipers', 438, 'swipers'),
  chanceFact('deck1.chance', 'Headline test chance', 96),
  chanceFact('deck2.chance', 'Product UI test chance', 95),
  countFact('comments', 'comments', 41, 'comments'),
]);
const DRAFT = {
  classification: classifyExperiment(HEADLINE_DECIDED),
  outline: 'Buyers respond to the payment benefit, not the voice feature.',
  facts: ['deck1.chance', 'deck2.chance'],
  sourceTemplate: 'Source: {decks} · {swipers} · Flagsmith {deck1.chance} and {deck2.chance} · {comments}',
};

test('writeInsight: mock wording with placeholders passes the rules', async () => {
  const provider = createMockProvider({
    responses: {
      results_explainer: JSON.stringify({ text: 'Buyers choose “get paid” ({deck1.chance} winner).' }),
    },
  });
  const r = await writeInsight({ provider, task: 'results_explainer', draft: DRAFT, table: TABLE });
  assert.equal(r.ok, true);
  assert.equal(r.text, 'Buyers choose “get paid” (96% winner).');
  assert.equal(r.sourceLine, 'Source: 2 decks · 438 swipers · Flagsmith 96% and 95% · 41 comments');
});

test('writeInsight: wording with a typed figure is hidden', async () => {
  const provider = createMockProvider({
    responses: { results_explainer: JSON.stringify({ text: 'Chance is 97% for the winner.' }) },
  });
  const r = await writeInsight({ provider, task: 'results_explainer', draft: DRAFT, table: TABLE });
  assert.equal(r.ok, false);
  assert.equal(r.stage, 'draft');
});

test('writeInsight: non-JSON output is hidden at the parse stage', async () => {
  const provider = createMockProvider({ responses: { results_explainer: 'plain text, no json' } });
  const r = await writeInsight({ provider, task: 'results_explainer', draft: DRAFT, table: TABLE });
  assert.equal(r.ok, false);
  assert.equal(r.stage, 'parse');
});

test('writeInsight: a persona classification never reaches the wording step', async () => {
  const provider = createMockProvider();
  const draft = { ...DRAFT, classification: classifyExperiment({ source: 'persona', cards: [] }) };
  const r = await writeInsight({ provider, task: 'product_insights', draft, table: TABLE });
  assert.equal(r.ok, false);
  assert.equal(r.stage, 'tag');
});
