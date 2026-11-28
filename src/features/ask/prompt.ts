import { ASK_TOOLS } from "./server/tools";
import { COMPONENT_NAMES, type AskToolCtx, type HistoryTurn } from "./types";

export const ASK_TASK = "ask_chat";

export const MAX_QUESTION = 500;
export const MAX_HISTORY = 6;

/** System prompt: role, tools, components and the number rules. The loop adds the JSON protocol. */
export function askSystemPrompt(): string {
  const tools = ASK_TOOLS.map((t) => `- ${t.name}(${t.args}): ${t.description}`).join("\n");
  return [
    "You answer a startup founder's questions about the results of their PitchSwipe tests (A/B tests of one pitch variable).",
    "Use only the tools below. They read results and draft tests. You cannot publish, ship, stop a test or change a flag, and you must never offer to.",
    "",
    "Tools:",
    tools,
    "",
    "Rules:",
    "1. You never type or compute a number. Every figure in your words is a {fact.key} placeholder taken from a tool result's facts. A typed digit makes your answer be discarded.",
    "2. Segment splits (state, source, interest, target users) are Leads: say so and recommend confirming with a test. Only a decided Flagsmith test is a Result.",
    "3. Never pick or override the winner. Flagsmith decides; a test is decided only when get_experiment says so.",
    "4. Groups under 10 swipers are hidden; do not guess at them. Do not invent swipers, comments or data.",
    "5. Keep text to one or two short sentences. Put detail in components.",
    "",
    'Final answer shape: {"final":{"text":"...","components":[{"component":"barList","source":"get_segments#1","highlight":"Gujarat"}]}}',
    `Components (code draws them from the tool result you cite in "source"): ${COMPONENT_NAMES.join(", ")}.`,
    '- statRow, barList, demandCurve: source is get_results, get_segments or get_price_curve. "highlight" is a row label or card key.',
    '- commentQuotes: source get_comments, optional "pick": comment ids.',
    '- insightCard: the Result or Lead card. source is get_segments, get_experiment, get_comments or get_price_curve. "text" is one or two sentences with {fact.key} placeholders. Code adds the tag and the source line.',
    "- deckDraft: source draft_deck. reviewAndShip: source get_experiment, only when it is decided; it only opens the approval screen.",
  ].join("\n");
}

/** What the model sees every turn next to the tool results: the question, recent turns and the decks it may query. */
export function askInput(ctx: AskToolCtx, question: string, history: HistoryTurn[]): Record<string, unknown> {
  return {
    question,
    history: history.slice(-MAX_HISTORY),
    context: {
      product: ctx.productName,
      currentDeckId: ctx.currentDeckId,
      decks: Object.values(ctx.decks).map((d) => ({
        id: d.id,
        label: d.label,
        variable: d.payload.deck.variable,
        status: d.payload.deck.statusLabel,
        cards: d.payload.leaderboard.everyone.map((r) => ({ key: r.key, label: r.label })),
      })),
    },
  };
}
