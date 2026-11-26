import { getLlmProvider, runToolLoop, type LlmProvider } from "@/lib/ai";

import { composeAnswer } from "./compose";
import { askMockResponder } from "./mock-planner";
import { ASK_TASK, MAX_HISTORY, MAX_QUESTION, askInput, askSystemPrompt } from "./prompt";
import { ASK_TOOLS } from "./tools";
import type { AskAnswer, AskToolCtx, HistoryTurn } from "./types";

/** The provider the app uses: env provider when LLM_API_KEY is set, otherwise the deterministic mock. */
export function askProvider(): LlmProvider {
  return getLlmProvider({ mock: { task: ASK_TASK, respond: askMockResponder } });
}

/** Validates the history the browser sends back: short plain turns only. */
export function cleanHistory(raw: unknown): HistoryTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: HistoryTurn[] = [];
  for (const t of raw.slice(-MAX_HISTORY)) {
    const turn = t as { role?: unknown; text?: unknown };
    if ((turn.role === "user" || turn.role === "assistant") && typeof turn.text === "string" && turn.text.trim()) {
      out.push({ role: turn.role, text: turn.text.trim().slice(0, MAX_QUESTION) });
    }
  }
  return out;
}

/** One chat turn: tool-calling loop, then code builds and checks the answer. Never writes anything. */
export async function runAsk(options: {
  provider: LlmProvider;
  ctx: AskToolCtx;
  question: string;
  history?: HistoryTurn[];
}): Promise<AskAnswer> {
  const question = options.question.trim().slice(0, MAX_QUESTION);
  const loop = await runToolLoop({
    provider: options.provider,
    task: ASK_TASK,
    system: askSystemPrompt(),
    input: askInput(options.ctx, question, options.history ?? []),
    tools: ASK_TOOLS,
    ctx: options.ctx,
  });
  return composeAnswer(loop, { name: options.provider.name, model: options.provider.model });
}
