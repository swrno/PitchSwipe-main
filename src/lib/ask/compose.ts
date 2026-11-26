/**
 * Turns the model's final JSON into an answer the app can render (spec 05 section 6.7 + 6.5).
 *
 *  - The model's text is post-checked: figures only as {fact.key} placeholders, filled by code,
 *    every number in the filled text shown by a cited fact. Failure replaces the text with a safe line.
 *  - Components are specs that point at tool steps. Code builds every row, count and percent from the
 *    tool result; the model supplies only which component, which step, and which row to highlight.
 *  - insightCard is the Result or Lead card: tag from code (segments are Leads, groups under 10 are
 *    refused, a Result needs the Flagsmith rules), source line from code, at most 2 Leads per answer.
 */
import { ai, buildFactTable, checkAndFill, type InsightDraft, type SourceFact, type ToolLoopResult, type ToolStep } from "@/lib/ai";

import {
  commentMeta,
  type CommentsToolResult,
  type DraftToolResult,
  type ExperimentToolResult,
  type PriceToolResult,
  type ResultsToolResult,
  type SegmentsToolResult,
} from "./tools";
import { COMPONENT_NAMES, type AskAnswer, type BarRow, type ChatStep, type ComponentSpec, type RenderedComponent } from "./types";

export const FALLBACK_TEXT = "I could not check the numbers in my wording, so I am showing only the data.";
export const NO_ANSWER_TEXT = "I could not answer that from your results. Try one of the suggested questions.";
export const MAX_COMPONENTS = 6;
const MAX_TEXT = 700;
const BAR_FILL = 0.88;

export interface ProviderInfo {
  name: string;
  model: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function parseSpecs(final: Record<string, unknown>): ComponentSpec[] {
  if (!Array.isArray(final.components)) return [];
  const out: ComponentSpec[] = [];
  for (const raw of final.components.slice(0, MAX_COMPONENTS)) {
    if (!isRecord(raw) || typeof raw.component !== "string") continue;
    out.push({
      component: raw.component,
      source: typeof raw.source === "string" ? raw.source : undefined,
      highlight: typeof raw.highlight === "string" ? raw.highlight : undefined,
      pick: Array.isArray(raw.pick) ? raw.pick.filter((x): x is string => typeof x === "string").slice(0, 6) : undefined,
      text: typeof raw.text === "string" ? raw.text.slice(0, MAX_TEXT) : undefined,
    });
  }
  return out;
}

function uniqueFacts(steps: ToolStep[], extra: SourceFact[]): SourceFact[] {
  const seen = new Set<string>();
  const out: SourceFact[] = [];
  for (const f of [...steps.flatMap((s) => s.facts), ...extra]) {
    if (seen.has(f.key)) continue;
    seen.add(f.key);
    out.push(f);
  }
  return out;
}

/* Bar lists ------------------------------------------------------------------ */

function fractions(values: number[]): number[] {
  const max = Math.max(...values, 0);
  return values.map((v) => (max > 0 ? Math.min(1, (v / max) * BAR_FILL) : 0));
}

const sameLabel = (a: string, b?: string) => !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

const BY_TITLE: Record<string, string> = { state: "state", source: "source", interest: "interest", target: "target users" };

function segmentBars(r: SegmentsToolResult, highlight?: string): RenderedComponent {
  const shown = r.rows.slice(0, 6);
  const rows: BarRow[] = shown.map((x) => ({
    label: x.label,
    valueText: `${x.joinRatePct}%`,
    countText: `${x.joined} of ${x.swipers}`,
    fraction: 0,
    highlight: sameLabel(x.label, highlight),
  }));
  const rates = shown.map((x) => x.joinRatePct);
  let footnote: string | null = null;
  if (r.other) {
    if (r.other.swipers !== null && r.other.joinRatePct !== null) {
      rows.push({ label: "Other", valueText: `${r.other.joinRatePct}%`, countText: `${r.other.joined} of ${r.other.swipers}`, fraction: 0, highlight: false });
      rates.push(r.other.joinRatePct);
    }
    footnote = `Groups with under 10 swipers are not shown (${r.other.groups} merged into Other).`;
  }
  const f = fractions(rates);
  rows.forEach((row, i) => (row.fraction = f[i]));
  return {
    kind: "barList",
    title: `Joined the waitlist, by ${BY_TITLE[r.by] ?? r.by}`,
    subtitle: r.deck,
    rows,
    footnote: r.overlapping ? "One person can follow several interests, so groups add up to more than the total." : footnote,
  };
}

function cardBars(r: ResultsToolResult, highlight?: string): RenderedComponent {
  const f = fractions(r.cards.map((c) => c.joinRatePct));
  return {
    kind: "barList",
    title: "Joined the waitlist, by card",
    subtitle: r.deck,
    rows: r.cards.map((c, i) => ({
      label: c.label,
      valueText: `${c.joinRatePct.toFixed(1)}%`,
      countText: `${c.joined} of ${c.swipers} joined`,
      fraction: f[i],
      highlight: sameLabel(c.label, highlight) || sameLabel(c.key, highlight),
    })),
    footnote: null,
  };
}

function priceBars(r: PriceToolResult, highlight?: string): RenderedComponent {
  const f = fractions(r.rows.map((x) => x.joinedPct));
  return {
    kind: "barList",
    title: "Joined the waitlist, by price",
    subtitle: r.deck,
    rows: r.rows.map((x, i) => ({
      label: x.priceShort,
      valueText: `${x.joinedPct}%`,
      countText: x.joinedOfText,
      fraction: f[i],
      highlight: highlight ? sameLabel(x.priceShort, highlight) || sameLabel(x.key, highlight) : x.isBest,
    })),
    footnote: `${r.headline} Revenue per price: ${r.rows.map((x) => `${x.priceShort} ${x.revenueText}`).join("; ")}.`,
  };
}

/* Insight cards ------------------------------------------------------------------ */

interface InsightBuild {
  draft: InsightDraft;
  extraFacts: SourceFact[];
}

const place = (key: string) => `{${key}}`;
const keysIn = (text: string) => [...new Set(ai.placeholderKeys(text))];

function insightFor(spec: ComponentSpec, step: ToolStep, steps: ToolStep[], n: number): InsightBuild | string {
  const wording = spec.text ?? "";
  const facts = keysIn(wording);
  const src = `src${n}`;
  const chanceFrom = (deckId: string) =>
    steps.find((s) => s.ok && s.tool === "get_experiment" && (s.result as ExperimentToolResult).deckId === deckId)?.result as ExperimentToolResult | undefined;

  if (step.tool === "get_segments") {
    const r = step.result as SegmentsToolResult;
    const row = (spec.highlight ? r.rows.find((x) => sameLabel(x.label, spec.highlight)) : undefined) ?? r.rows[0];
    if (!row) return "no group to build a Lead from";
    const classification = ai.classifySegment({ swipers: row.swipers });
    const extra: SourceFact[] = [
      { key: `${src}.swipers`, value: r.overall.swipers, display: `${r.overall.swipers.toLocaleString("en-US")} swipers` },
      { key: `${src}.groups`, value: r.groupCount, display: `1 of ${r.groupCount} ${BY_TITLE[r.by] ?? r.by} groups` },
    ];
    let template = `${r.deck} · ${place(`${src}.swipers`)}, ${place(`${src}.groups`)}`;
    const exp = chanceFrom(r.deckId) ?? steps.map((s) => (s.ok && s.tool === "get_experiment" ? (s.result as ExperimentToolResult) : null)).find((x) => x && x.leaderChancePct !== null);
    if (exp && exp.leaderChancePct !== null && exp.leaderLabel) {
      extra.push({ key: `${src}.chance`, value: exp.leaderChancePct, display: `${exp.leaderChancePct}%` });
      template += ` · ${exp.deck}: ${exp.leaderLabel}, Flagsmith ${place(`${src}.chance`)}`;
    }
    return { draft: { classification, facts, sourceTemplate: template }, extraFacts: extra };
  }

  if (step.tool === "get_experiment") {
    const r = step.result as ExperimentToolResult;
    if (!r.tag || r.leaderChancePct === null || !r.leaderLabel) return "the test has no chance to quote yet";
    const classification = { tag: r.tag as "Result" | "Leading", groupSize: undefined, reasons: r.reasons } as unknown as InsightDraft["classification"];
    return {
      draft: { classification, facts, sourceTemplate: `${r.deck} · ${r.leaderLabel}, Flagsmith ${place(`${step.ref}.leader.chance`)}` },
      extraFacts: [],
    };
  }

  if (step.tool === "get_comments") {
    const r = step.result as CommentsToolResult;
    if (r.total === 0) return "there are no comments to build a card from";
    const groupSize = r.card ? r.card.swipers : r.total;
    let template = `${r.deck}`;
    if (r.card) {
      template += ` · ${r.card.label}: ${place(`${step.ref}.card.swipers`)} swipers`;
      if (r.card.chanceBestPct !== null) template += `, ${place(`${step.ref}.card.chance`)} chance best (Flagsmith)`;
    }
    template += ` · ${place(`${step.ref}.count`)}, ${place(`${step.ref}.voice`)}`;
    return {
      draft: { classification: { tag: "Lead", groupSize, reasons: [] }, facts, sourceTemplate: template },
      extraFacts: [],
    };
  }

  if (step.tool === "get_price_curve") {
    const r = step.result as PriceToolResult;
    const best = r.rows.find((x) => x.isBest);
    let template = `${r.deck} · ${place(`${step.ref}.total.swipers`)} swipers`;
    if (best) {
      const k = `${step.ref}.${best.key.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
      template += ` · ${place(`${k}.price`)}, ${place(`${k}.chance`)} chance it earns most (Flagsmith)`;
    }
    return {
      draft: { classification: { tag: r.verdict === "result" ? "Result" : "Lead", groupSize: r.totalSwipers, reasons: [] }, facts, sourceTemplate: template },
      extraFacts: [],
    };
  }
  return `insightCard cannot use ${step.tool}`;
}

/* Compose --------------------------------------------------------------------------- */

export function composeAnswer(loop: ToolLoopResult, provider: ProviderInfo): AskAnswer {
  const steps = loop.steps;
  const chatSteps: ChatStep[] = steps
    .filter((s) => s.ok)
    .map((s) => ({ id: s.id, tool: s.tool, summary: s.summary, call: s.call, ok: true }));
  const base = { steps: chatSteps, provider: provider.name, model: loop.model };

  if (!loop.final) return { ...base, text: NO_ANSWER_TEXT, components: [], notes: loop.error ? [loop.error] : [] };

  const notes: string[] = [];
  const specs = parseSpecs(loop.final);
  const insightSpecs = specs.filter((s) => s.component === "insightCard");
  const extraFacts: SourceFact[] = [];
  const builds = new Map<ComponentSpec, InsightBuild | string>();
  insightSpecs.forEach((spec, i) => {
    const step = steps.find((s) => s.ok && s.id === spec.source);
    const built = step ? insightFor(spec, step, steps, i + 1) : "the card pointed at a tool call that did not happen";
    builds.set(spec, built);
    if (typeof built !== "string") extraFacts.push(...built.extraFacts);
  });
  const table = buildFactTable(uniqueFacts(steps, extraFacts));

  // The model's own words.
  const rawText = typeof loop.final.text === "string" ? loop.final.text.slice(0, MAX_TEXT) : "";
  let text = "";
  if (rawText.trim()) {
    const checked = checkAndFill(rawText, table);
    if (checked.ok) text = checked.text;
    else {
      text = FALLBACK_TEXT;
      notes.push("Hid the written answer: a number in it could not be matched to your data.");
    }
  }

  // Insight cards: build, then enforce the page limits (at most 2 Leads).
  const results = new Map<ComponentSpec, ReturnType<typeof ai.buildInsight>>();
  for (const spec of insightSpecs) {
    const built = builds.get(spec);
    if (!built || typeof built === "string") {
      notes.push(`Hid a card: ${built ?? "no source"}.`);
      continue;
    }
    results.set(spec, ai.buildInsight({ draft: built.draft, table, wordedText: spec.text ?? "" }));
  }
  const page = ai.applyPageLimits([...results.values()]);
  const shown = new Set(page.shown);
  for (const h of page.hidden) {
    notes.push(h.reason === "page lead limit" ? "Showing at most 2 Leads per answer." : "Hid a card: its numbers could not be checked against your data.");
  }

  const components: RenderedComponent[] = [];
  for (const spec of specs) {
    const name = spec.component;
    if (!(COMPONENT_NAMES as readonly string[]).includes(name)) {
      notes.push(`Skipped an unknown component (${name.slice(0, 30)}).`);
      continue;
    }
    if (name === "insightCard") {
      const r = results.get(spec);
      if (r && r.ok && shown.has(r)) components.push({ kind: "insightCard", tag: r.tag, tagLabel: r.tagLabel, text: r.text, sourceLine: r.sourceLine });
      continue;
    }
    const step = steps.find((s) => s.ok && s.id === spec.source);
    if (!step) {
      notes.push(`Skipped ${name}: it pointed at a tool call that did not happen.`);
      continue;
    }
    const rendered = renderOne(name, spec, step);
    if (typeof rendered === "string") notes.push(rendered);
    else components.push(rendered);
  }

  // Drafts can carry a note (for example "no decided winner yet"); show it, never hide why a lock is missing.
  for (const s of steps) {
    if (s.ok && s.tool === "draft_deck" && (s.result as DraftToolResult).lockNote) notes.push((s.result as DraftToolResult).lockNote as string);
  }

  return { ...base, text, components, notes: [...new Set(notes)] };
}

function renderOne(name: string, spec: ComponentSpec, step: ToolStep): RenderedComponent | string {
  switch (name) {
    case "statRow": {
      if (step.tool !== "get_results") return "Skipped statRow: it needs get_results.";
      const t = (step.result as ResultsToolResult).totals;
      return {
        kind: "statRow",
        items: [
          { label: "Swipers", value: t.swipers.toLocaleString("en-US") },
          { label: "Said yes", value: t.saidYes.toLocaleString("en-US") },
          { label: "Joined", value: t.joined.toLocaleString("en-US") },
        ],
      };
    }
    case "barList":
    case "demandCurve": {
      if (step.tool === "get_segments") return segmentBars(step.result as SegmentsToolResult, spec.highlight);
      if (step.tool === "get_results") return cardBars(step.result as ResultsToolResult, spec.highlight);
      if (step.tool === "get_price_curve") return priceBars(step.result as PriceToolResult, spec.highlight);
      return `Skipped ${name}: it cannot draw ${step.tool}.`;
    }
    case "commentQuotes": {
      if (step.tool !== "get_comments") return "Skipped commentQuotes: it needs get_comments.";
      const r = step.result as CommentsToolResult;
      const chosen = spec.pick?.length ? r.comments.filter((c) => spec.pick?.includes(c.id)) : r.comments.slice(0, 3);
      if (chosen.length === 0) return "Skipped commentQuotes: no matching comments.";
      return {
        kind: "commentQuotes",
        quotes: chosen.slice(0, 3).map((c) => ({ id: c.id, text: c.text.slice(0, 300), meta: commentMeta(c), voice: c.kind === "voice" })),
      };
    }
    case "deckDraft": {
      if (step.tool !== "draft_deck") return "Skipped deckDraft: it needs draft_deck.";
      const r = step.result as DraftToolResult;
      const chips = [...r.versions, ...(r.roles.length ? [r.roles.join(", ")] : []), ...(r.locked ? [r.locked] : [])];
      return { kind: "deckDraft", title: r.title, chips, published: false };
    }
    case "reviewAndShip": {
      if (step.tool !== "get_experiment") return "Skipped reviewAndShip: it needs get_experiment.";
      const r = step.result as ExperimentToolResult;
      if (r.verdictKind !== "decided" || !r.leaderLabel) return "Skipped reviewAndShip: the test is not decided.";
      return { kind: "reviewAndShip", deckId: r.deckId, label: `Review ${r.leaderLabel}`, text: `${r.headline} Nothing changes until you approve.` };
    }
    default:
      return `Skipped ${name}.`;
  }
}
