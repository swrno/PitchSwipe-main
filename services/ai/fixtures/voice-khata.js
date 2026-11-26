// Demo data from goal/spec/08-build-reference.md §13 (Voice Khata, founder Arjun Sen).
// Test fixtures only. Numbers copied exactly from the spec; see test/demo-numbers.test.js for the checks.

// §13.2 headline test, group rows (order: Swipers, Said yes, Joined).
export const HEADLINE_GROUPS = {
  total: { label: 'Total', swipers: 214, said: 98, joined: 26 },
  B: { label: 'Headline B', swipers: 71, said: 38, joined: 13 },
  A: { label: 'Headline A', swipers: 72, said: 34, joined: 8 },
  C: { label: 'Headline C', swipers: 71, said: 26, joined: 5 },
  feed: { label: 'Feed', swipers: 160, said: 70, joined: 14 },
  link: { label: 'Personal link', swipers: 54, said: 28, joined: 12 },
  targetUsers: { label: 'Target users', swipers: 71, said: 45, joined: 16 },
  everyoneElse: { label: 'Everyone else', swipers: 143, said: 53, joined: 10 },
  gujarat: { label: 'Gujarat', swipers: 41, said: 22, joined: 9 },
  maharashtra: { label: 'Maharashtra', swipers: 62, said: 28, joined: 8 },
  westBengal: { label: 'West Bengal', swipers: 27, said: 12, joined: 3 },
  uttarPradesh: { label: 'Uttar Pradesh', swipers: 33, said: 13, joined: 2 },
  delhi: { label: 'Delhi', swipers: 27, said: 11, joined: 2 },
  hiddenStates: { label: 'Hidden states', swipers: 24, said: 12, joined: 2 },
};

// §13.2 state rows as they appear in the table (order preserved).
export const STATE_ROWS = ['gujarat', 'maharashtra', 'westBengal', 'uttarPradesh', 'delhi', 'hiddenStates'];

// §13.1 card (headline deck). Three variants differ only in headline.
export const HEADLINE_CARDS = [
  {
    id: 'A',
    headline: 'Speak your sales. The ledger writes itself.',
    category: 'Voice ledger · Retail',
    price: 'Rs 299 / mo',
    reward: 'Get 3 months free at launch',
    question: 'Would you pay Rs 299 a month?',
    answers: ['Yes, I would pay', 'No, I would not'],
    madeFor: ['Shop owner', 'Wholesaler'],
  },
  {
    id: 'B',
    headline: 'Stop chasing payments. Get paid on time.',
    category: 'Voice ledger · Retail',
    price: 'Rs 299 / mo',
    reward: 'Get 3 months free at launch',
    question: 'Would you pay Rs 299 a month?',
    answers: ['Yes, I would pay', 'No, I would not'],
    madeFor: ['Shop owner', 'Wholesaler'],
  },
  {
    id: 'C',
    headline: 'Your whole ledger for Rs 10 a day.',
    category: 'Voice ledger · Retail',
    price: 'Rs 299 / mo',
    reward: 'Get 3 months free at launch',
    question: 'Would you pay Rs 299 a month?',
    answers: ['Yes, I would pay', 'No, I would not'],
    madeFor: ['Shop owner', 'Wholesaler'],
  },
];

// Headline deck, decided state (§13.1 and §13.2 decided line). Identities per card are
// taken from the §13.2 per-card swipers because the spec gives no per-card identity count.
export const HEADLINE_DECIDED = {
  source: 'flagsmith',
  status: 'decided',
  srmWarning: false,
  cards: [
    { id: 'B', chancePct: 96, identities: 71 },
    { id: 'A', chancePct: 3, identities: 72 },
    { id: 'C', chancePct: 1, identities: 71 },
  ],
};
