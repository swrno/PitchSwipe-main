/**
 * Public surface of the app's AI adapter (see README.md). Everything else in the app imports from here,
 * never from ./engine directly.
 */
export { ai } from "./services";
export { getLlmProvider, type MockResponder } from "./provider";
export { createLlmProvider, isLlmConfigured, llmVendor, translateModel, type LlmVendor } from "./llm-env";
export { buildFactTable, checkAndFill, factSlug, type WordingCheck } from "./rules";
export {
  PROTOCOL,
  extractJson,
  runToolLoop,
  type ToolDef,
  type ToolLoopOptions,
  type ToolLoopResult,
  type ToolOutput,
  type ToolStep,
} from "./tool-loop";
export type {
  Classification,
  ExperimentInput,
  InsightDraft,
  InsightResult,
  LlmProvider,
  LlmRequest,
  LlmResponse,
  SourceFact,
  SourceTable,
  Tag,
} from "./services-ai";
