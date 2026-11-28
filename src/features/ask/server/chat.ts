/**
 * "Ask your results" on the Vercel AI SDK (server only): native tool calling + generative UI.
 *
 *  - One SDK tool per ASK_TOOLS entry (read-only; draft_deck only drafts) plus `show`, which draws components.
 *  - Number safety: the model never types a figure. Every text block it writes is held back by
 *    `numberGuard` and, at its end, replaced by checkAndFill(text, every fact seen this request)
 *    or by FALLBACK_TEXT. Components are built by code from tool results (compose.ts buildComponents).
 *  - No key: a scripted mock model (askMockResponder) drives the same tools over the founder's real data.
 */
import { MockLanguageModelV4 } from "ai/test";
import { stepCountIs, streamText, tool, type LanguageModel, type ModelMessage, type StreamTextTransform, type TextStreamPart, type ToolSet } from "ai";
import { z } from "zod";

import { checkAndFill, type LlmRequest, type SourceFact, type ToolStep } from "@/shared/lib/ai";
import { sdkModel } from "@/shared/lib/ai/sdk-model";

import { FALLBACK_TEXT, answerFactTable, buildComponents } from "../compose";
import { askMockResponder } from "../mock-planner";
import { MAX_QUESTION, askInput } from "../prompt";
import { ASK_TOOLS } from "./tools";
import { COMPONENT_NAMES, SEGMENT_BY_NAMES, type AskToolCtx, type ComponentSpec, type RenderedComponent } from "../types";

export const MAX_CHAT_MESSAGES = 8;
const MAX_TOOL_ROUNDS = 8;

/* Per-request state --------------------------------------------------------------- */

export interface ChatRun {
  ctx: AskToolCtx;
  steps: ToolStep[];
  /** Facts that insight cards added (needed to check the written text). */
  extraFacts: SourceFact[];
  counts: Map<string, number>;
}

export const newRun = (ctx: AskToolCtx): ChatRun => ({ ctx, steps: [], extraFacts: [], counts: new Map() });

/* Tools ---------------------------------------------------------------------------- */

const deck = z.string().optional().describe("Deck id or name. Defaults to the deck the founder is looking at.");

const INPUT_SCHEMAS: Record<string, z.ZodObject> = {
  get_results: z.object({ deck }),
  get_segments: z.object({ deck, by: z.enum(SEGMENT_BY_NAMES).describe("What to split by") }),
  get_experiment: z.object({ deck }),
  get_price_curve: z.object({ deck }),
  get_comments: z.object({
    deck,
    card: z.string().optional().describe('Card key such as "C"'),
    language: z.string().optional().describe('Spoken language such as "Hindi"'),
  }),
  draft_deck: z.object({
    variable: z.enum(["headline", "description", "reward", "price", "language"]),
    versions: z.array(z.string()).optional().describe("2 to 4 short versions in words, no digits"),
    audience: z.array(z.string()).optional(),
    state: z.string().optional(),
    lock_from_deck: z.string().optional(),
  }),
};

const showSchema = z.object({
  components: z
    .array(
      z.object({
        component: z.enum(COMPONENT_NAMES),
        source: z.string().optional().describe('Tool call id from a data tool result, e.g. "get_segments#1"'),
        highlight: z.string().optional().describe("Row label or card key to emphasise"),
        pick: z.array(z.string()).optional().describe("commentQuotes: comment ids"),
        text: z.string().optional().describe("insightCard: wording with {fact.key} placeholders, never digits"),
      }),
    )
    .max(6),
});

export function buildChatTools(run: ChatRun): ToolSet {
  const tools: ToolSet = {};
  for (const def of ASK_TOOLS) {
    tools[def.name] = tool({
      description: `${def.description} Args: ${def.args}`,
      inputSchema: INPUT_SCHEMAS[def.name] ?? z.object({}),
      async execute(input) {
        const args = input as Record<string, unknown>;
        const n = (run.counts.get(def.name) ?? 0) + 1;
        run.counts.set(def.name, n);
        const id = `${def.name}#${n}`;
        const ref = `${def.name}${n}`;
        try {
          const out = await def.run(args, run.ctx, ref);
          run.steps.push({ id, ref, tool: def.name, args, ok: true, summary: out.summary, call: out.call, result: out.result, facts: out.facts });
          return {
            id,
            summary: out.summary,
            call: out.call,
            result: out.result,
            facts: Object.fromEntries(out.facts.map((f) => [f.key, f.display])),
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : "The tool failed.";
          run.steps.push({ id, ref, tool: def.name, args, ok: false, summary: "", call: def.name, result: { error: message }, facts: [] });
          return { id, error: message };
        }
      },
    });
  }
  tools.show = tool({
    description:
      "Draw components in the chat from tool results you already have. Code builds every number. Call it once after the data tools, then write 1 to 2 sentences.",
    inputSchema: showSchema,
    async execute(input: z.infer<typeof showSchema>): Promise<{ components: RenderedComponent[]; notes: string[] }> {
      const built = buildComponents(run.steps, input.components as ComponentSpec[]);
      run.extraFacts.push(...built.extraFacts);
      return { components: built.components, notes: built.notes };
    },
  });
  return tools;
}

/* Number guard ------------------------------------------------------------------------ */

/**
 * Holds back each text block until it ends, then emits the checked, filled text (or the safe line).
 * The model's raw words never reach the browser.
 */
export function numberGuard(run: ChatRun): StreamTextTransform<ToolSet> {
  return () => {
    const held = new Map<string, string>();
    return new TransformStream<TextStreamPart<ToolSet>, TextStreamPart<ToolSet>>({
      transform(part, controller) {
        // The model's reasoning is never part of the answer and is not number-checked: drop it.
        if (part.type.startsWith("reasoning")) return;
        if (part.type === "text-start") {
          held.set(part.id, "");
          return;
        }
        if (part.type === "text-delta" && held.has(part.id)) {
          held.set(part.id, (held.get(part.id) ?? "") + part.text);
          return;
        }
        if (part.type === "text-end" && held.has(part.id)) {
          const raw = (held.get(part.id) ?? "").trim();
          held.delete(part.id);
          if (!raw) return;
          const checked = checkAndFill(raw, answerFactTable(run.steps, run.extraFacts));
          controller.enqueue({ type: "text-start", id: part.id });
          controller.enqueue({ type: "text-delta", id: part.id, text: checked.ok ? checked.text : FALLBACK_TEXT });
          controller.enqueue(part);
          return;
        }
        controller.enqueue(part);
      },
    });
  };
}

/* System prompt -------------------------------------------------------------------------- */

export function chatSystemPrompt(ctx: AskToolCtx): string {
  const context = askInput(ctx, "", []).context;
  return [
    "You answer a startup founder's questions about the results of their PitchSwipe decks (A/B tests of one pitch variable).",
    "Use only your tools. They read results and draft decks. You cannot publish, ship, stop a test or change a flag, and you must never offer to.",
    "",
    "How to answer:",
    "1. Call the data tools you need (get_results, get_segments, get_experiment, get_price_curve, get_comments, draft_deck).",
    "2. Then call `show` once with the components that answer the question. Code draws them and fills every number from the tool results you cite as `source` (a tool call id such as get_segments#1).",
    "3. Then write 1 or 2 short sentences. Do not repeat what the components show.",
    "",
    "Rules:",
    "- You never type or compute a number. Every figure in your words, and in an insightCard `text`, is a {fact.key} placeholder using a key from a tool result's `facts`. A typed digit makes your sentence be replaced.",
    "- Segment splits (state, source, interest, target users) are Leads: say so and recommend confirming with a test. Only a decided Flagsmith test is a Result.",
    "- Never pick or override the winner. Flagsmith decides; a test is decided only when get_experiment says so.",
    "- Groups under 10 swipers are hidden; do not guess at them. Do not invent swipers, comments or data.",
    "- Tool results from earlier turns are gone. Call the tools again for each new question.",
    "",
    `Components for \`show\`: ${COMPONENT_NAMES.join(", ")}.`,
    '- statRow, barList, demandCurve: source is a get_results, get_segments or get_price_curve call. "highlight" is a row label or card key.',
    '- commentQuotes: source get_comments, optional "pick": comment ids.',
    '- insightCard: the Result or Lead card. source is get_segments, get_experiment, get_comments or get_price_curve. "text" is one or two sentences with {fact.key} placeholders. Code adds the tag and the source line.',
    "- deckDraft: source draft_deck. reviewAndShip: source get_experiment, only when it is decided; it only opens the approval screen.",
    "",
    `Context: ${JSON.stringify(context)}`,
  ].join("\n");
}

/* Messages ----------------------------------------------------------------------------------- */

export interface IncomingMessage {
  role: "user" | "assistant";
  text: string;
}

/** Plain text turns only: tool parts from earlier turns are dropped (their ids are stale), so a client cannot smuggle results in. */
export function cleanMessages(raw: unknown): IncomingMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: IncomingMessage[] = [];
  for (const m of raw.slice(-MAX_CHAT_MESSAGES)) {
    const msg = m as { role?: unknown; parts?: unknown };
    if (msg.role !== "user" && msg.role !== "assistant") continue;
    const parts = Array.isArray(msg.parts) ? (msg.parts as { type?: unknown; text?: unknown }[]) : [];
    const text = parts
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text as string)
      .join("\n")
      .trim()
      .slice(0, MAX_QUESTION * 2);
    if (text) out.push({ role: msg.role, text });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

/* Models -------------------------------------------------------------------------------------- */

const USAGE = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
};

type V4Part = Awaited<ReturnType<NonNullable<MockLanguageModelV4["doStream"]>>>["stream"] extends ReadableStream<infer P> ? P : never;

function streamOf(parts: V4Part[]) {
  return {
    stream: new ReadableStream<V4Part>({
      start(c) {
        c.enqueue({ type: "stream-start", warnings: [] });
        for (const p of parts) c.enqueue(p);
        c.close();
      },
    }),
  };
}

const textParts = (id: string, text: string): V4Part[] => [
  { type: "text-start", id },
  { type: "text-delta", id, delta: text },
  { type: "text-end", id },
];

const finish = (unified: "stop" | "tool-calls"): V4Part => ({ type: "finish", usage: USAGE, finishReason: { unified, raw: undefined } });

/** A model that just says one thing (no deck yet, and so on). */
export function sayModel(text: string): LanguageModel {
  return new MockLanguageModelV4({ doStream: async () => streamOf([...textParts("t1", text), finish("stop")]) });
}

/** No LLM key: askMockResponder scripts the same tool calls a real model would make, then `show`, then text. */
export function mockModel(run: ChatRun, question: string): LanguageModel {
  let pendingText: string | null = null;
  let seq = 0;
  return new MockLanguageModelV4({
    doStream: async () => {
      if (pendingText !== null) {
        const text = pendingText;
        pendingText = null;
        return streamOf([...textParts("t1", text), finish("stop")]);
      }
      const user = JSON.stringify({
        ...askInput(run.ctx, question, []),
        toolResults: run.steps.map((s) => ({
          id: s.id,
          tool: s.tool,
          args: s.args,
          ok: s.ok,
          result: s.result,
          facts: Object.fromEntries(s.facts.map((f) => [f.key, f.display])),
        })),
      });
      const reply = JSON.parse(askMockResponder({ task: "ask_chat", system: "", user } satisfies LlmRequest)) as {
        tool_calls?: { tool: string; args: Record<string, unknown> }[];
        final?: { text?: string; components?: unknown[] };
      };
      if (reply.tool_calls?.length) {
        return streamOf([
          ...reply.tool_calls.slice(0, 3).map((c): V4Part => ({ type: "tool-call", toolCallId: `mock${++seq}`, toolName: c.tool, input: JSON.stringify(c.args ?? {}) })),
          finish("tool-calls"),
        ]);
      }
      const text = typeof reply.final?.text === "string" ? reply.final.text : "";
      const components = Array.isArray(reply.final?.components) ? reply.final.components : [];
      if (components.length) {
        pendingText = text;
        return streamOf([{ type: "tool-call", toolCallId: `mock${++seq}`, toolName: "show", input: JSON.stringify({ components }) }, finish("tool-calls")]);
      }
      return streamOf([...textParts("t1", text), finish("stop")]);
    },
  });
}

/* Entry --------------------------------------------------------------------------------------- */

/** The streaming chat turn. Returns the AI SDK UI message stream response. */
export function runChat(options: { ctx: AskToolCtx; messages: IncomingMessage[]; abortSignal?: AbortSignal }): Response {
  const { ctx, messages } = options;
  const run = newRun(ctx);
  const real = sdkModel();
  const question = [...messages].reverse().find((m) => m.role === "user")?.text.slice(0, MAX_QUESTION) ?? "";
  const modelMessages: ModelMessage[] = messages.map((m) => ({ role: m.role, content: m.text }));
  const result = streamText({
    model: real ? real.model : mockModel(run, question),
    system: chatSystemPrompt(ctx),
    messages: modelMessages,
    tools: buildChatTools(run),
    stopWhen: stepCountIs(MAX_TOOL_ROUNDS),
    // A rate limit switches to the fallback model at once (sdk-model.ts); one more try at most, no long backoff.
    maxRetries: 1,
    experimental_transform: numberGuard(run),
    abortSignal: options.abortSignal,
    onError: ({ error }) => console.error("chat: stream error", error instanceof Error ? error.message : error),
  });
  return result.toUIMessageStreamResponse({
    headers: { "cache-control": "no-store" },
    onError: () => "Could not answer that. Try again.",
  });
}

