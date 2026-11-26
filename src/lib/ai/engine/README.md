# src/lib/ai/engine — WP12 AI services (formerly services/ai)

Framework-agnostic, dependency-free ES modules. The Next.js app (WP0) imports from `src/index.js`.

Spec: `docs/spec/05-insights-and-ai.md` §6 (rules in §6.5). Demo data: `docs/spec/08-build-reference.md` §13.

## Layout

- `src/llm/` — provider contract (`complete({ task, system, user })`), deterministic mock, env-driven real provider stub.
- `src/rules/` — rules engine:
  - `numbers.js` number tokens, canonical form, placeholders
  - `source-table.js` the only source of figures (key, value, display)
  - `post-check.js` draft check (no literal numbers, only cited `{key}` placeholders) and filled check (every number from an allowed fact)
  - `tagging.js` Result / Lead / Leading / Inconclusive / Simulated; segment groups under 10 fold into "Other"; persona track record
  - `insight.js` `buildInsight` (fill, post-check, source line) and `applyPageLimits` (all Results, at most 2 Leads)
  - `facts.js` count, percent and chance formatting into table facts
  - `card-checks.js` one-variable deck shape, language-draft figure check, theme counts from code
- `src/prompts/templates.js` prompt templates: 3 angles, card checker, language draft, why-people-swiped themes, persona pre-test (Simulated), wording prompt for results explainer and product insights. Prompts carry keys and labels, never figures.
- `src/services/insights.js` `writeInsight`: prompt, parse JSON, run the rules.
- `fixtures/voice-khata.js` §13 demo numbers.

## Env

- `LLM_API_KEY` required for `createLlmProviderFromEnv`; never hardcoded or logged.
- `LLM_MODEL` optional (default `claude-sonnet-5-5`).
- `LLM_BASE_URL` optional (default the Anthropic Messages endpoint).

The Next.js app does not use this env provider for live calls: `src/lib/ai/anthropic-provider.ts` calls Claude through the official Anthropic SDK with the same `complete()` contract. There, `LLM_BASE_URL` is an API base such as `https://api.anthropic.com`, and `LLM_MODEL` defaults to `claude-opus-5-5`.

The env provider is a stub: request and response shape are implemented, but it has not been run against the live API. Tests inject a fake fetch.

## Tests

```bash
cd src/lib/ai/engine
npm test      # or from the repo root: npm test -- ai-engine
```

No real LLM calls happen in tests.

## Known gaps

- The post-check matches digits only. Number words ("three cards") are not checked.
- Persona track record and angle/theme prompts are not yet wired into a UI or route (WP13, WP15).
