import { assertProvider } from './provider.js';

// Real provider, configured only from the environment:
//   LLM_API_KEY   required, never hardcoded, never logged
//   LLM_MODEL     optional, default below
//   LLM_BASE_URL  optional, default is the Anthropic Messages endpoint
// Stub status: request/response shape is implemented but NOT exercised against the live API in this package.
// Tests inject a fake fetch and never call the network.

export const DEFAULT_LLM_URL = 'https://api.anthropic.com/v1/messages';
export const DEFAULT_LLM_MODEL = 'claude-sonnet-5-5';

export function createLlmProviderFromEnv(env = process.env, { fetchImpl = globalThis.fetch } = {}) {
  const apiKey = env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error('LLM_API_KEY is not set. Use createMockProvider() for offline runs.');
  }
  const url = env.LLM_BASE_URL || DEFAULT_LLM_URL;
  const model = env.LLM_MODEL || DEFAULT_LLM_MODEL;

  const provider = {
    name: 'env',
    model,
    async complete({ system, user, maxTokens = 1024 }) {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content: user }],
        }),
      });
      if (!res.ok) throw new Error(`LLM request failed with status ${res.status}`);
      const data = await res.json();
      const text = (data.content ?? [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');
      return { text, model };
    },
  };
  return assertProvider(provider);
}
