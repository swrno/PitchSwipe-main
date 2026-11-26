// LLM provider contract. Services call provider.complete() and never read env or SDKs directly.
//
//   request:  { task, system, user, maxTokens? }
//   response: { text, model }
//
// `task` names the prompt template (the mock uses it to pick a canned answer).

export function assertProvider(provider) {
  if (!provider || typeof provider.complete !== 'function') {
    throw new TypeError('LLM provider must implement complete({ task, system, user })');
  }
  return provider;
}
