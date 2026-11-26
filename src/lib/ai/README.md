# src/lib/ai: TypeScript adapter over services/ai (WP12)

`services/ai` is plain ESM JavaScript (no types; `allowJs` is off). This folder is the only place the app touches it.
Import from `@/lib/ai`, never from `services/ai`. Types for the JS exports live in `services-ai.d.ts` (hand-written; add to it when you use another export).

## Public API (`@/lib/ai`)

| Export | What it is |
|---|---|
| `ai` | Typed handle on the services/ai module: `createMockProvider`, `createLlmProviderFromEnv`, `createSourceTable`, `checkDraft`, `checkFilled`, `placeholderKeys`, `fillPlaceholders`, `classifyExperiment`, `classifySegment`, `buildInsight`, `applyPageLimits`, `TAG_LABELS`, `THRESHOLDS`. |
| `getLlmProvider({ mock: { task, respond }, env?, fetchImpl? })` | `LLM_API_KEY` set: the env provider (never run live yet; stub in services/ai). Otherwise the deterministic mock answering `task` with `respond`. |
| `buildFactTable(facts)` | Source table. A fact is `{ key, value, display }`; `display` is the exact text printed and must contain `value`. |
| `checkAndFill(wording, table, allowedKeys?)` | Rules 1 and 2 of spec 05 section 6.5 for any model text: only `{fact.key}` placeholders, no typed digits; code fills them and re-checks every number in the result. Returns `{ ok, text }` or `{ ok: false, stage, problems }`. Failed text is hidden, never repaired. |
| `factSlug(label)` | Placeholder-safe key part ("Uttar Pradesh" becomes `uttar_pradesh`). |
| `runToolLoop({ provider, task, system, input, tools, ctx })` | Generic tool-calling loop over `provider.complete()`. JSON protocol: the model replies `{"tool_calls":[...]}` or `{"final":{...}}`. Only tools you pass can run; errors go back to the model as results. Max 4 turns, 6 calls. Returns `{ steps, final, model, error? }`. |
| `extractJson`, `PROTOCOL`, types `ToolDef`, `ToolStep`, `ToolOutput`, `LlmProvider`, `SourceFact`, `SourceTable`, `InsightResult`, `Tag` | Supporting pieces. |

The provider interface is single-shot text (`complete({ task, system, user })`), so tool calling is a JSON protocol in the prompt, not a vendor tool API. Each turn the whole state (question, deck list, tool results with their facts) is sent as the `user` JSON.

## Rules the adapter enforces for callers

- Tools return `facts`; the model cites them as `{tool1.row.metric}`; code fills them. A tool result's figures are the only figures allowed.
- Segment findings are Leads, groups under 10 swipers are never listed, a Result needs the Flagsmith rules (the Results screen verdict), at most 2 Leads per answer (`applyPageLimits`).
- Nothing here can publish, ship, stop a test or change a flag. The chat tools (`src/lib/ask/tools.ts`) are read and draft only.

## Env

- `LLM_API_KEY`: enables the real provider. Server only; never logged or sent to the client.
- `LLM_MODEL` (default `claude-sonnet-5-5`), `LLM_BASE_URL` (default Anthropic Messages endpoint).
- `LLM_TRANSLATE_MODEL` (optional): model for voice-note translation only (`src/lib/claims/voice-text.ts`). Unset, it uses `LLM_MODEL`. Without `LLM_API_KEY` there is no translation at all (no mock), and the swiper types the English.
- Unset: the deterministic mock runs, so demo mode and tests never make a network call.

## Tests

`node --import ./scripts/register-ts.mjs --test src/lib/ai/ai.test.ts src/lib/ask/ask.test.ts`
