import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupFacts, createSourceTable, classifyExperiment, checkDeckShape, TAGS } from '../src/index.js';
import {
  HEADLINE_GROUPS as G,
  STATE_ROWS,
  HEADLINE_CARDS,
  HEADLINE_DECIDED,
} from '../fixtures/voice-khata.js';

// Checks the §13.2 demo table against itself and against the strings the spec quotes.

const rowsOf = (keys) => keys.map((k) => G[k]);
const sum = (rows, field) => rows.reduce((a, r) => a + r[field], 0);

test('§13.2 variant rows add up to the total, feed and link splits', () => {
  const variants = rowsOf(['B', 'A', 'C']);
  for (const f of ['swipers', 'said', 'joined']) {
    assert.equal(sum(variants, f), G.total[f], `variants ${f}`);
  }
  assert.equal(G.feed.swipers + G.link.swipers, G.total.swipers);
  assert.equal(G.feed.said + G.link.said, G.total.said);
  assert.equal(G.feed.joined + G.link.joined, G.total.joined);
});

test('§13.2 target users and everyone else add up to the total', () => {
  assert.equal(G.targetUsers.swipers + G.everyoneElse.swipers, G.total.swipers);
  assert.equal(G.targetUsers.said + G.everyoneElse.said, G.total.said);
  assert.equal(G.targetUsers.joined + G.everyoneElse.joined, G.total.joined);
});

test('§13.2 state rows add up to the total swipers', () => {
  assert.equal(sum(rowsOf(STATE_ROWS), 'swipers'), G.total.swipers);
  assert.equal(sum(rowsOf(STATE_ROWS), 'joined'), G.total.joined);
});

test('§13.2 join rates match the strings the spec quotes', () => {
  const shown = (key, decimals) => groupFacts(key, G[key], { decimals }).find((f) => f.key.endsWith('joinRate')).display;
  assert.equal(shown('B', 1), '18.3%');
  assert.equal(shown('A', 1), '11.1%');
  assert.equal(shown('C', 1), '7.0%');
  assert.equal(shown('total', 0), '12%');
  assert.equal(shown('targetUsers', 0), '23%');
  assert.equal(shown('everyoneElse', 0), '7%');
  assert.equal(shown('gujarat', 0), '22%');
  assert.equal(shown('maharashtra', 0), '13%');
});

test('the §13.2 "said yes" total is 46% of swipers', () => {
  assert.equal(Math.round((G.total.said / G.total.swipers) * 100), 46);
});

test('§13.1 headline decided at 96% is a Result; the 91% results snapshot is only Leading', () => {
  assert.equal(classifyExperiment(HEADLINE_DECIDED).tag, TAGS.RESULT);
  const live = classifyExperiment({
    ...HEADLINE_DECIDED,
    status: 'live',
    cards: [{ id: 'B', chancePct: 91, identities: 71 }, { id: 'A', chancePct: 6, identities: 72 }, { id: 'C', chancePct: 3, identities: 71 }],
  });
  assert.equal(live.tag, TAGS.LEADING);
});

test('§13.1 headline cards differ only in headline (one-variable rule)', () => {
  assert.equal(checkDeckShape(HEADLINE_CARDS, 'headline').ok, true);
  const broken = HEADLINE_CARDS.map((c, i) => (i === 2 ? { ...c, price: 'Rs 199 / mo' } : c));
  const r = checkDeckShape(broken, 'headline');
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.type === 'locked_field_differs' && p.field === 'price'));
});

test('source table built from §13.2 groups shows the spec join rates', () => {
  const table = createSourceTable(groupFacts('B', G.B, { decimals: 1 }));
  assert.equal(table.display('B.joinRate'), '18.3%');
  assert.equal(table.display('B.joined'), '13');
});
