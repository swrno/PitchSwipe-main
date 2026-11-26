import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalize,
  extractNumbers,
  placeholderKeys,
  stripPlaceholders,
  createSourceTable,
  checkDraft,
  checkFilled,
  classifyExperiment,
  classifySegment,
  groupSegments,
  personaTrackRecord,
  buildInsight,
  applyPageLimits,
  TAGS,
  groupFacts,
  countFact,
  chanceFact,
} from '../src/index.js';
import { HEADLINE_DECIDED } from '../fixtures/voice-khata.js';

test('canonicalize treats thousands separators, trailing zeros and times consistently', () => {
  assert.equal(canonicalize('1,600'), '1600');
  assert.equal(canonicalize('18.30'), '18.3');
  assert.equal(canonicalize('18:42'), '18:42');
  assert.equal(canonicalize('0.25'), '0.25');
});

test('extractNumbers finds currency, percents, times and counts', () => {
  const found = extractNumbers('Rs 0.25 per swipe, 96% chance at 18:42 across 1,600 swipers').map((n) => n.canonical);
  assert.deepEqual(found, ['0.25', '96', '18:42', '1600']);
});

test('placeholders are removed before literal-number checks, so digits in keys are not flagged', () => {
  const text = 'Headline ({deck1.chance}) and {price.deck} lead.';
  assert.deepEqual(placeholderKeys(text), ['deck1.chance', 'price.deck']);
  assert.deepEqual(extractNumbers(stripPlaceholders(text)), []);
});

test('source table rejects a display that does not show its value', () => {
  assert.throws(() => createSourceTable([{ key: 'x', value: 18.3, display: '18%' }]), /does not show value/);
});

test('source table rejects duplicate and unknown keys', () => {
  assert.throws(
    () => createSourceTable([{ key: 'x', value: 1, display: '1' }, { key: 'x', value: 2, display: '2' }]),
    /duplicate/,
  );
  const table = createSourceTable([{ key: 'x', value: 1, display: '1' }]);
  assert.throws(() => table.get('nope'), /unknown fact/);
});

test('draft check rejects a literal figure typed by the model', () => {
  const table = createSourceTable([{ key: 'deck1.chance', value: 96, display: '96%' }]);
  const r = checkDraft('Chance is 96%, see {deck1.chance}.', table, ['deck1.chance']);
  assert.equal(r.ok, false);
  assert.equal(r.problems[0].type, 'literal_number');
});

test('draft check rejects a placeholder the insight did not cite', () => {
  const table = createSourceTable([
    { key: 'deck1.chance', value: 96, display: '96%' },
    { key: 'deck2.chance', value: 95, display: '95%' },
  ]);
  const r = checkDraft('Only {deck2.chance} here.', table, ['deck1.chance']);
  assert.deepEqual(r.problems, [{ type: 'fact_not_cited', key: 'deck2.chance' }]);
});

test('filled check rejects rounded, invented and misattributed figures', () => {
  const table = createSourceTable([
    { key: 'B.joinRate', value: 18.3, display: '18.3%' },
    { key: 'A.joinRate', value: 11.1, display: '11.1%' },
  ]);
  assert.equal(checkFilled('B joins at 18.3%.', table).ok, true);
  assert.equal(checkFilled('B joins at 18%.', table).ok, false); // rounded
  assert.equal(checkFilled('B joins at 19.3%.', table).ok, false); // invented
  assert.equal(checkFilled('B joins at 11.1%.', table, ['B.joinRate']).ok, false); // misattributed
});

test('a running test is Leading and never counted as a Result', () => {
  const c = classifyExperiment({ ...HEADLINE_DECIDED, status: 'live', cards: [
    { id: 'B', chancePct: 91, identities: 71 },
    { id: 'A', chancePct: 6, identities: 72 },
    { id: 'C', chancePct: 3, identities: 71 },
  ] });
  assert.equal(c.tag, TAGS.LEADING);
  assert.equal(c.counted, false);
});

test('a decided test is a Result at 95% and 50 identities per card', () => {
  const c = classifyExperiment(HEADLINE_DECIDED);
  assert.equal(c.tag, TAGS.RESULT);
  assert.equal(c.counted, true);
  assert.equal(c.winnerId, 'B');
});

test('Result boundaries: 94% and 49 identities and an SRM warning each block a Result', () => {
  const at = (chancePct, identities, srmWarning = false) =>
    classifyExperiment({ ...HEADLINE_DECIDED, srmWarning, cards: [
      { id: 'B', chancePct, identities },
      { id: 'A', chancePct: 100 - chancePct, identities: 80 },
    ] });
  assert.equal(at(95, 50).tag, TAGS.RESULT);
  assert.equal(at(94, 50).tag, TAGS.INCONCLUSIVE);
  assert.equal(at(96, 49).tag, TAGS.INCONCLUSIVE);
  assert.equal(at(96, 50, true).tag, TAGS.INCONCLUSIVE);
});

test('persona predictions are Simulated and never counted', () => {
  const c = classifyExperiment({ source: 'persona', status: 'decided', cards: [] });
  assert.equal(c.tag, TAGS.SIMULATED);
  assert.equal(c.counted, false);
});

test('segments are Leads only from groups of 10 or more; smaller groups fold into Other', () => {
  assert.equal(classifySegment({ swipers: 9 }).shown, false);
  assert.equal(classifySegment({ swipers: 10 }).tag, TAGS.LEAD);
  const { leads, other } = groupSegments([
    { key: 'gujarat', label: 'Gujarat', swipers: 41, said: 22, joined: 9 },
    { key: 'x', label: 'X', swipers: 4, said: 2, joined: 1 },
    { key: 'y', label: 'Y', swipers: 6, said: 3, joined: 0 },
  ]);
  assert.equal(leads.length, 1);
  assert.deepEqual(other, { key: 'other', label: 'Other', swipers: 10, said: 5, joined: 1 });
});

test('persona track record counts only finished decks', () => {
  const r = personaTrackRecord([
    { finished: true, predictedId: 'A', winnerId: 'B' },
    { finished: true, predictedId: 'B', winnerId: 'B' },
    { finished: true, predictedId: 'C', winnerId: 'A' },
    { finished: false, predictedId: 'A', winnerId: null },
  ]);
  assert.deepEqual(r, { right: 1, total: 3, label: 'Unproven' });
});

// --- insight building -------------------------------------------------------

const RESULT_TABLE = createSourceTable([
  countFact('decks', 'decks', 2, 'decks'),
  countFact('swipers', 'swipers', 438, 'swipers'),
  chanceFact('deck1.chance', 'Headline test chance', 96),
  chanceFact('deck2.chance', 'Product UI test chance', 95),
  countFact('comments', 'comments', 41, 'comments'),
]);

const RESULT_DRAFT = {
  classification: { tag: TAGS.RESULT, counted: true },
  outline: 'Buyers respond to the payment benefit, not the voice feature.',
  facts: ['deck1.chance', 'deck2.chance'],
  sourceTemplate: 'Source: {decks} · {swipers} · Flagsmith {deck1.chance} and {deck2.chance} · {comments}',
};

test('a Result insight fills numbers from code and builds the §13.2 source line', () => {
  const r = buildInsight({
    draft: RESULT_DRAFT,
    table: RESULT_TABLE,
    wordedText:
      'People buy “get paid”, not “voice”: the winning headline ({deck1.chance}) and the winning product UI ({deck2.chance}) both talk about collecting dues.',
  });
  assert.equal(r.ok, true);
  assert.equal(r.tag, 'Result');
  assert.equal(r.tagLabel, 'Result');
  assert.equal(r.sourceLine, 'Source: 2 decks · 438 swipers · Flagsmith 96% and 95% · 41 comments');
  assert.match(r.text, /\(96%\) .* \(95%\)/);
});

test('an insight whose wording types a figure is hidden at the draft stage', () => {
  const r = buildInsight({
    draft: RESULT_DRAFT,
    table: RESULT_TABLE,
    wordedText: 'The winning headline reaches 97% ({deck1.chance}) and the UI {deck2.chance}.',
  });
  assert.equal(r.ok, false);
  assert.equal(r.stage, 'draft');
});

test('an insight cannot use a figure from a fact it did not cite', () => {
  const r = buildInsight({
    draft: { ...RESULT_DRAFT, facts: ['deck1.chance'] },
    table: RESULT_TABLE,
    wordedText: 'Headline {deck1.chance}, UI {deck2.chance}.',
  });
  assert.equal(r.ok, false);
  assert.equal(r.detail[0].type, 'fact_not_cited');
});

test('a simulated or inconclusive classification is never shown as an insight', () => {
  for (const tag of [TAGS.SIMULATED, TAGS.INCONCLUSIVE]) {
    const r = buildInsight({
      draft: { ...RESULT_DRAFT, classification: { tag } },
      table: RESULT_TABLE,
      wordedText: 'Headline {deck1.chance}.',
    });
    assert.equal(r.ok, false);
    assert.equal(r.stage, 'tag');
  }
});

test('a Leading insight is labelled not decided', () => {
  const r = buildInsight({
    draft: { ...RESULT_DRAFT, classification: { tag: TAGS.LEADING } },
    table: RESULT_TABLE,
    wordedText: 'Headline {deck1.chance} is leading so far.',
  });
  assert.equal(r.ok, true);
  assert.equal(r.tagLabel, 'Leading, not decided');
});

test('a Lead must come from a group of 10 or more', () => {
  const r = buildInsight({
    draft: { ...RESULT_DRAFT, classification: { tag: TAGS.LEAD, groupSize: 9 } },
    table: RESULT_TABLE,
    wordedText: 'Headline {deck1.chance}.',
  });
  assert.equal(r.ok, false);
});

test('page limits keep every Result and at most two Leads, largest groups first', () => {
  const ok = (tag, groupSize, text) => ({ ok: true, tag, groupSize, text });
  const { shown, hidden } = applyPageLimits([
    ok(TAGS.LEAD, 27, 'small'),
    ok(TAGS.RESULT, null, 'result'),
    ok(TAGS.LEAD, 83, 'price'),
    ok(TAGS.LEAD, 41, 'gujarat'),
    { ok: false, stage: 'draft', detail: [] },
  ]);
  assert.deepEqual(shown.map((i) => i.text), ['result', 'price', 'gujarat']);
  assert.equal(hidden.length, 2);
  assert.ok(hidden.some((h) => h.reason === 'page lead limit'));
});

test('a Gujarat Lead reproduces the §6.7 sentence exactly from code-filled figures', () => {
  const table = createSourceTable([
    ...groupFacts('gujarat', { label: 'Gujarat', swipers: 41, said: 22, joined: 9 }, { decimals: 0 }),
    ...groupFacts('maharashtra', { label: 'Maharashtra', swipers: 62, said: 28, joined: 8 }, { decimals: 0 }),
  ]);
  const r = buildInsight({
    draft: {
      classification: { tag: TAGS.LEAD, groupSize: 41 },
      outline: 'Gujarat has the highest join rate of the states.',
      facts: ['gujarat.joinRate', 'maharashtra.joinRate', 'gujarat.swipers'],
      sourceTemplate: 'Source: Gujarat group · {gujarat.swipers} swipers · {gujarat.joined} joined waitlist',
    },
    table,
    wordedText:
      'Gujarat joins most: {gujarat.joinRate}, vs {maharashtra.joinRate} next best. Only {gujarat.swipers} swipers, so test price there before you rely on it.',
  });
  assert.equal(r.ok, true);
  assert.equal(
    r.text,
    'Gujarat joins most: 22%, vs 13% next best. Only 41 swipers, so test price there before you rely on it.',
  );
  assert.equal(r.tagLabel, 'Lead · confirm with a test');
});
