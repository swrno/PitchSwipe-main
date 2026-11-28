/**
 * Deterministic stand-in for the model (no LLM key, and tests): the same JSON protocol a real model
 * uses, scripted per suggested question. It reads tool results and writes only {fact.key}
 * placeholders, never a figure, so the real post-check still runs on its output.
 */
import { factSlug, type LlmRequest } from "@/shared/lib/ai";

interface Step {
  id: string;
  tool: string;
  ok: boolean;
  result: Record<string, unknown>;
  facts: Record<string, string>;
}
interface DeckInfo {
  id: string;
  label: string;
  variable: string;
  cards: { key: string; label: string }[];
}

const ref = (s: Step) => s.id.replace("#", "");
const calls = (...c: { tool: string; args: Record<string, unknown> }[]) => JSON.stringify({ tool_calls: c });
const done = (text: string, components: Record<string, unknown>[]) => JSON.stringify({ final: { text, components } });

const NEXT_HEADLINES = ["Know who owes you money", "Your shop ledger in your own voice", "Never forget a due again"];

export function askMockResponder(request: LlmRequest): string {
  const input = JSON.parse(request.user) as {
    question: string;
    context: { currentDeckId: string; decks: DeckInfo[] };
    toolResults: Step[];
  };
  const q = input.question.toLowerCase();
  const decks = input.context.decks;
  const current = decks.find((d) => d.id === input.context.currentDeckId) ?? decks[0];
  const priceDeck = decks.find((d) => d.variable === "price");
  const results = input.toolResults;
  const find = (tool: string) => results.find((r) => r.tool === tool && r.ok);
  const tried = (tool: string) => results.some((r) => r.tool === tool);
  const has = (s: Step, key: string) => key in s.facts;

  /* Why did C lose? */
  if (/\blos[et]\b|why did/.test(q)) {
    const key = (/why did (\w+) lose/.exec(q)?.[1] ?? "c").toUpperCase();
    if (results.length === 0) {
      return calls({ tool: "get_comments", args: { deck: current.id, card: key } }, { tool: "get_results", args: { deck: current.id } });
    }
    const comments = find("get_comments");
    const res = find("get_results");
    const components: Record<string, unknown>[] = [];
    if (res) components.push({ component: "barList", source: res.id, highlight: key });
    const label = current.cards.find((c) => c.key === key)?.label ?? key;
    if (comments && (comments.result.total as number) > 0) {
      components.push({ component: "commentQuotes", source: comments.id });
      const chance = has(comments, `${ref(comments)}.card.chance`) ? ` (Flagsmith: {${ref(comments)}.card.chance} chance best)` : "";
      components.push({
        component: "insightCard",
        source: comments.id,
        text: `${label} lost${chance}; comments point to clarity, not price. Test a clearer description to confirm.`,
      });
      return done(`Here is how the cards compare and what people said about ${label}.`, components);
    }
    return done(`There are no comments on ${label} yet, so here is how the cards compare.`, components);
  }

  /* Do target users disagree with everyone else? */
  if (/target|disagree/.test(q)) {
    if (results.length === 0) {
      return calls({ tool: "get_segments", args: { deck: current.id, by: "target" } }, { tool: "get_experiment", args: { deck: current.id } });
    }
    const seg = find("get_segments");
    const rows = (seg?.result.rows as { label: string }[] | undefined) ?? [];
    if (!seg || rows.length < 2) {
      return done("Target users or everyone else have fewer than 10 swipers so far, so I cannot compare them yet.", []);
    }
    const [t, e] = [`${ref(seg)}.${factSlug("Target users")}.joinRate`, `${ref(seg)}.${factSlug("Everyone else")}.joinRate`];
    return done("Target users join at {" + t + "}; everyone else at {" + e + "}.", [
      { component: "barList", source: seg.id, highlight: "Target users" },
      {
        component: "insightCard",
        source: seg.id,
        highlight: "Target users",
        text: "Target users join at {" + t + "}, everyone else at {" + e + "}. This is a lead: confirm it with a test on target users.",
      },
    ]);
  }

  /* Which price earns most? */
  if (/price|earn/.test(q) && !/state|where/.test(q)) {
    if (!priceDeck) return done("This product has no price test yet, so there is nothing to compare.", []);
    if (results.length === 0) {
      return calls({ tool: "get_price_curve", args: { deck: priceDeck.id } }, { tool: "get_experiment", args: { deck: priceDeck.id } });
    }
    const curve = find("get_price_curve");
    if (!curve) return done("The price test has no curve yet.", []);
    const best = (curve.result.rows as { key: string; isBest: boolean }[]).find((r) => r.isBest);
    if (!best) return done("No price stands out yet.", [{ component: "barList", source: curve.id }]);
    const k = `${ref(curve)}.${factSlug(best.key)}`;
    const verdict = curve.result.verdict === "result" ? "This is a Result." : "The test is not decided, so confirm it with more swipers.";
    return done("{" + k + ".price} earns the most so far.", [
      { component: "barList", source: curve.id },
      {
        component: "insightCard",
        source: curve.id,
        text: "{" + k + ".price} earns the most: {" + k + ".joinRate} joined and a {" + k + ".chance} chance it is best. " + verdict,
      },
    ]);
  }

  /* Which state should I test price in next? */
  if (/state|where/.test(q)) {
    if (results.length === 0) {
      return calls(
        { tool: "get_segments", args: { deck: current.id, by: "state" } },
        { tool: "get_experiment", args: { deck: (priceDeck ?? current).id } },
      );
    }
    const seg = find("get_segments");
    const rows = (seg?.result.rows as { label: string }[] | undefined) ?? [];
    if (!seg || rows.length === 0) return done("No state has 10 swipers yet, so I cannot rank them.", []);
    if (!tried("draft_deck") && priceDeck) {
      return calls({ tool: "draft_deck", args: { variable: "price", state: rows[0].label, lock_from_deck: current.id } });
    }
    const exp = find("get_experiment");
    const k0 = `${ref(seg)}.${factSlug(rows[0].label)}`;
    const k1 = rows[1] ? `${ref(seg)}.${factSlug(rows[1].label)}` : null;
    const lead = k1
      ? `${rows[0].label} joins most: {${k0}.joinRate}, vs {${k1}.joinRate} next best. Only {${k0}.swipers} swipers, so test price there before you rely on it.`
      : `${rows[0].label} joins most: {${k0}.joinRate}. Only {${k0}.swipers} swipers, so test price there before you rely on it.`;
    const components: Record<string, unknown>[] = [
      { component: "barList", source: seg.id, highlight: rows[0].label },
      { component: "insightCard", source: seg.id, highlight: rows[0].label, text: lead },
    ];
    const draft = find("draft_deck");
    if (draft) components.push({ component: "deckDraft", source: draft.id });
    const decided = exp?.result.verdictKind === "decided";
    return done(`${rows[0].label}. Its swipers join most, and your price test is ${decided ? "decided" : "not decided yet"}.`, components);
  }

  /* What should I test next? */
  if (/next|should i test|what should/.test(q)) {
    if (results.length === 0) {
      return calls({ tool: "get_results", args: { deck: current.id } }, { tool: "get_experiment", args: { deck: current.id } });
    }
    const res = find("get_results");
    const exp = find("get_experiment");
    if (!tried("draft_deck")) {
      const price = current.variable === "headline" && priceDeck;
      return calls({
        tool: "draft_deck",
        args: price
          ? { variable: "price", lock_from_deck: current.id }
          : { variable: "headline", versions: NEXT_HEADLINES, lock_from_deck: current.id },
      });
    }
    const components: Record<string, unknown>[] = [];
    if (res) components.push({ component: "statRow", source: res.id }, { component: "barList", source: res.id });
    if (exp && exp.result.leaderLabel && has(exp, `${ref(exp)}.leader.chance`)) {
      components.push({
        component: "insightCard",
        source: exp.id,
        text: `${exp.result.leaderLabel} leads with a {${ref(exp)}.leader.chance} chance of being best (Flagsmith). Test the next variable with it fixed on every card.`,
      });
    }
    const draft = find("draft_deck");
    if (draft) components.push({ component: "deckDraft", source: draft.id });
    return done("Here is a next test to try. It is a draft: nothing is published.", components);
  }

  /* Anything else: where things stand. */
  if (results.length === 0) return calls({ tool: "get_results", args: { deck: current.id } });
  const res = find("get_results");
  return done(
    "Ask about your cards, states, price or comments. Here is where this deck stands.",
    res ? [{ component: "statRow", source: res.id }, { component: "barList", source: res.id }] : [],
  );
}
