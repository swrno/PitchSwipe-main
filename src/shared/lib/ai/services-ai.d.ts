/**
 * Hand-written types for the parts of the AI engine in ./engine (plain ESM JavaScript, WP12) that the app uses.
 * tsconfig has allowJs off, so `services.ts` casts the JS module to `AiServices`.
 * Keep this in step with engine/src/index.js when you use another export.
 */

export interface LlmRequest {
  task: string;
  system: string;
  user: string;
  maxTokens?: number;
}
export interface LlmResponse {
  text: string;
  model: string;
}
export interface LlmProvider {
  name: string;
  model: string;
  complete(request: LlmRequest): Promise<LlmResponse>;
}
export interface MockProvider extends LlmProvider {
  calls: LlmRequest[];
}

export interface SourceFact {
  key: string;
  label?: string;
  /** The machine value. It must be one of the numbers shown in `display`. */
  value: number;
  /** Exact text the founder sees ("22%", "9 of 41"). */
  display: string;
}
export interface SourceTable {
  has(key: string): boolean;
  get(key: string): SourceFact & { numbers: Set<string> };
  display(key: string): string;
  keys(): string[];
  allowedNumbers(keys?: string[]): Set<string>;
}

export type Tag = "Result" | "Lead" | "Leading" | "Inconclusive" | "Simulated";
export interface Classification {
  tag: Tag | null;
  counted?: boolean;
  shown?: boolean;
  groupSize?: number;
  leaderId?: string;
  winnerId?: string;
  reasons: string[];
}
export interface ExperimentInput {
  source: "flagsmith" | "persona";
  status: string;
  srmWarning: boolean;
  cards: { id: string; chancePct: number; identities: number }[];
}

export interface CheckResult {
  ok: boolean;
  problems: { type: string; key?: string; raw?: string }[];
}

export interface InsightDraft {
  classification: Classification;
  outline?: string;
  facts: string[];
  sourceTemplate: string;
}
export type InsightResult =
  | { ok: true; tag: Tag; tagLabel: string; groupSize: number | null; text: string; sourceLine: string }
  | { ok: false; stage: string; detail: unknown };

export interface AiServices {
  createMockProvider(options?: {
    responses?: Record<string, string | ((request: LlmRequest) => string)>;
  }): MockProvider;
  createLlmProviderFromEnv(
    env?: Record<string, string | undefined>,
    options?: { fetchImpl?: typeof fetch },
  ): LlmProvider;
  createSourceTable(entries: SourceFact[]): SourceTable;
  checkDraft(text: string, table: SourceTable, allowedKeys?: string[]): CheckResult;
  checkFilled(text: string, table: SourceTable, allowedKeys?: string[]): CheckResult;
  placeholderKeys(text: string): string[];
  fillPlaceholders(text: string, fn: (key: string) => string): string;
  classifyExperiment(experiment: ExperimentInput): Classification;
  classifySegment(group: { swipers: number }): Classification;
  buildInsight(input: { draft: InsightDraft; table: SourceTable; wordedText: string }): InsightResult;
  applyPageLimits<T extends InsightResult>(
    insights: T[],
    options?: { maxLeads?: number },
  ): { shown: T[]; hidden: { reason: string; detail?: unknown; insight?: T }[] };
  extractNumbers(text: string): { raw: string; canonical: string; index: number }[];
  threeAnglesPrompt(input: { idea: unknown; product: unknown; targetRoles: unknown }): LlmRequest;
  checkLanguageDraft(draftText: string, sourceText: string): { ok: boolean; problems: { type: string; value?: string }[] };
  SYSTEM_RULES: string;
  TAG_LABELS: Record<Tag, string>;
  THRESHOLDS: { minChancePct: number; minIdentitiesPerCard: number; minGroupSize: number; maxLeadsPerPage: number };
}
