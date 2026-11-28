import type { LlmProvider, SourceFact } from "./services-ai";

/** What a tool hands back. `facts` are the only figures the model's wording may cite. */
export interface ToolOutput {
  result: unknown;
  facts: SourceFact[];
  /** Chat line, e.g. "Looked up results by state". */
  summary: string;
  /** Chat code text, e.g. get_segments(deck="headline", by="state"). */
  call: string;
}

export interface ToolDef<Ctx> {
  name: string;
  /** One line for the system prompt. */
  description: string;
  /** Argument shape for the system prompt, e.g. {"deck"?: string, "by": "state"}. */
  args: string;
  /**
   * `ref` is the unique prefix for this call's fact keys ("get_segments1").
   * Throw an Error with a plain message to report a problem to the model.
   */
  run(args: Record<string, unknown>, ctx: Ctx, ref: string): Promise<ToolOutput>;
}

export interface ToolStep {
  /** "get_segments#1": what components cite as their `source`. */
  id: string;
  /** Fact key prefix, "get_segments1". */
  ref: string;
  tool: string;
  args: Record<string, unknown>;
  ok: boolean;
  summary: string;
  call: string;
  result: unknown;
  facts: SourceFact[];
}

export interface ToolLoopResult {
  steps: ToolStep[];
  /** The model's `final` object, or null when it never produced one. */
  final: Record<string, unknown> | null;
  model: string;
  error?: string;
}

export const PROTOCOL = [
  "Reply with ONLY one JSON object, no prose around it.",
  'To use tools: {"tool_calls":[{"tool":"<name>","args":{...}}]}',
  'To answer: {"final":{...}}',
  'Tool results arrive in "toolResults". Each has "facts": a map of fact key to the text code will print.',
  "You never type or compute a number. Write figures as {fact.key} placeholders using keys from facts.",
].join("\n");

/** First JSON object in the text (tolerates code fences and surrounding prose). */
export function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const value: unknown = JSON.parse(text.slice(start, end + 1));
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export interface ToolLoopOptions<Ctx> {
  provider: LlmProvider;
  task: string;
  system: string;
  /** Sent to the model every turn next to the tool results (question, history, deck list). */
  input: Record<string, unknown>;
  tools: ToolDef<Ctx>[];
  ctx: Ctx;
  maxSteps?: number;
  maxCalls?: number;
}

/**
 * Generic tool-calling loop over provider.complete(). The model can only call tools in `tools`
 * (read and draft tools; there is no publish, ship or flag tool to call). A tool that throws is
 * reported back to the model as an error result, never to the user.
 */
export async function runToolLoop<Ctx>(opts: ToolLoopOptions<Ctx>): Promise<ToolLoopResult> {
  const { provider, tools, ctx } = opts;
  const maxSteps = opts.maxSteps ?? 4;
  const maxCalls = opts.maxCalls ?? 6;
  const byName = new Map(tools.map((t) => [t.name, t]));
  const counts = new Map<string, number>();
  const steps: ToolStep[] = [];
  const system = `${opts.system}\n\n${PROTOCOL}`;

  for (let turn = 0; turn < maxSteps; turn++) {
    const user = JSON.stringify({
      ...opts.input,
      toolResults: steps.map((s) => ({
        id: s.id,
        tool: s.tool,
        args: s.args,
        ok: s.ok,
        result: s.result,
        facts: Object.fromEntries(s.facts.map((f) => [f.key, f.display])),
      })),
    });
    const reply = await provider.complete({ task: opts.task, system, user, maxTokens: 1500 });
    const json = extractJson(reply.text);
    if (!json) return { steps, final: null, model: reply.model, error: "The model did not return JSON." };
    if (json.final && typeof json.final === "object") {
      return { steps, final: json.final as Record<string, unknown>, model: reply.model };
    }
    const calls: unknown[] = Array.isArray(json.tool_calls) ? json.tool_calls : [];
    if (calls.length === 0) return { steps, final: null, model: reply.model, error: "The model made no tool call and no answer." };

    for (const entry of calls.slice(0, 3)) {
      if (steps.length >= maxCalls) break;
      const raw = (entry && typeof entry === "object" ? entry : {}) as { tool?: unknown; args?: unknown };
      const name = typeof raw.tool === "string" ? raw.tool : "";
      const args =
        raw.args && typeof raw.args === "object" && !Array.isArray(raw.args) ? (raw.args as Record<string, unknown>) : {};
      const n = (counts.get(name) ?? 0) + 1;
      counts.set(name, n);
      const id = `${name}#${n}`;
      const ref = `${name}${n}`;
      const tool = byName.get(name);
      if (!tool) {
        const error = `Unknown tool ${name}. Tools: ${tools.map((t) => t.name).join(", ")}.`;
        steps.push({ id, ref, tool: name, args, ok: false, summary: "", call: name, result: { error }, facts: [] });
        continue;
      }
      try {
        const out = await tool.run(args, ctx, ref);
        steps.push({ id, ref, tool: name, args, ok: true, summary: out.summary, call: out.call, result: out.result, facts: out.facts });
      } catch (error) {
        const message = error instanceof Error ? error.message : "The tool failed.";
        steps.push({ id, ref, tool: name, args, ok: false, summary: "", call: name, result: { error: message }, facts: [] });
      }
    }
  }
  return { steps, final: null, model: provider.model, error: "The model used all its steps without answering." };
}
