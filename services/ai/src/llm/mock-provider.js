import { assertProvider } from './provider.js';

// Deterministic canned answers, one per task. None contains a figure.
const DEFAULTS = {
  three_angles: () =>
    JSON.stringify({
      angles: [
        { angle: 'problem', headline: 'Stop chasing payments', description: 'Collect dues without the phone calls.' },
        { angle: 'outcome', headline: 'Get paid on time', description: 'Every sale recorded and every due tracked.' },
        { angle: 'price', headline: 'Your whole ledger, less than chai', description: 'A simple plan for a small shop.' },
      ],
    }),
  card_check: () => JSON.stringify({ issues: [] }),
  language_draft: () => JSON.stringify({ text: '' }),
  swipe_themes: () => JSON.stringify({ themes: [] }),
  results_explainer: () => JSON.stringify({ text: '' }),
  product_insights: () => JSON.stringify({ text: '' }),
  persona_pretest: () => JSON.stringify({ picks: [] }),
};

/**
 * Mock provider for tests and offline runs. `responses` may override any task:
 * a string, or a function (request) => string.
 */
export function createMockProvider({ responses = {} } = {}) {
  const calls = [];
  const provider = {
    name: 'mock',
    model: 'mock-1',
    calls,
    async complete(request) {
      calls.push(request);
      const override = responses[request.task];
      let text;
      if (override !== undefined) text = typeof override === 'function' ? override(request) : override;
      else if (DEFAULTS[request.task]) text = DEFAULTS[request.task](request);
      else throw new Error(`mock provider has no answer for task ${request.task}`);
      return { text, model: provider.model };
    },
  };
  return assertProvider(provider);
}
