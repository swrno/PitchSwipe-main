/**
 * Product insights (WP15, spec 05 sections 6.3 and 6.5). Pure apart from the injected LLM provider.
 *
 *  - Code fills every number. The model writes only a title and a sentence or two, citing figures as
 *    {fact.key} placeholders. Each text goes through checkAndFill / buildInsight (rules 1 and 2). A text
 *    that fails, or a model that is off or errors, is replaced by code's own template, run through the
 *    same checks. If even that fails the card is hidden.
 *  - A Result needs the Flagsmith rules on every deck it names (finished, 95% chance, 50 identities per
 *    card, no sample-ratio warning). A running deck is "Leading", never a Result.
 *  - Anything from a segment (target users, a state) is a Lead, from groups of 10 or more only; at most
 *    two Leads per page, ranked by group size.
 *  - Persona results are shown on their own card as Simulated and Unproven and never reach a count.
 */
import { LIMITS } from "@/shared/lib/limits";
import {
  ai,
  buildFactTable,
  checkAndFill,
  extractJson,
  type Classification,
  type InsightResult,
  type LlmProvider,
  type SourceFact,
  type SourceTable,
} from "@/shared/lib/ai";
import { TEST_VARIABLE_LABELS, TEST_VARIABLES } from "@/shared/lib/lists";
import { saidYesVsActed } from "@/features/results/insights";

import type {
  DeckFacts,
  InsightCardView,
  InsightsPayload,
  PersonaCardView,
  PersonaInput,
  SuggestionView,
  ThemeGroup,
  WinnerRow,
} from "./types";

const MIN_PCT = Math.round(LIMITS.winnerConfidence * 100);
export const WORDING_TASK = "product_insights";
export const THEMES_TASK = "swipe_themes";
const MAX_TITLE = 80;
const MAX_TEXT = 400;
const MAX_THEME_LABEL = 60;
const MAX_THEME_COMMENTS = 40;
const MIN_THEME_COMMENTS = 3;
const MAX_THEME_GROUPS = 3;

/** Text a model must never produce here: combining winners, persona evidence. Failing it uses the template. */
const BANNED_WORDING = /\b(together|combined?|combination|persona|personas|simulated)\b/i;

/* Small helpers -------------------------------------------------------------------- */

const int = (n: number): string => Math.round(n).toLocaleString("en-US");
const plural = (n: number, one: string, many: string): string => `${int(n)} ${n === 1 ? one : many}`;
const k = (d: DeckFacts): string => `d${d.index}`;
const place = (key: string): string => `{${key}}`;

/** "{a}", "{a} and {b}", "{a}, {b} and {c}" */
function listPhrase(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const fact = (key: string, label: string, value: number, display: string): SourceFact => ({ key, label, value, display });

/** The text of a leading card as it may appear in code-written text: a fact placeholder when it has digits. */
function leaderRef(d: DeckFacts, facts: SourceFact[]): string {
  const text = d.leaderText ?? "";
  const digits = text.match(/\d+(?:\.\d+)?/);
  if (!digits) return text || "The leading version";
  facts.push(fact(`${k(d)}.leader`, `${d.label} leading card`, Number(digits[0]), text));
  return place(`${k(d)}.leader`);
}

/* Classification ------------------------------------------------------------------- */

export function classifyDeck(d: DeckFacts): Classification {
  return ai.classifyExperiment({
    source: "flagsmith",
    status: d.finished ? "decided" : "live",
    srmWarning: d.srmWarning,
    cards: d.cards,
  });
}

function bestChance(d: DeckFacts): number | null {
  if (d.leaderChancePct !== null) return Math.round(d.leaderChancePct);
  if (d.cards.length === 0) return null;
  return Math.round(Math.max(...d.cards.map((c) => c.chancePct)));
}

export function winnerRows(decks: DeckFacts[]): WinnerRow[] {
  return decks.map((d) => {
    const cls = classifyDeck(d);
    const chance = bestChance(d);
    let statusText: string;
    let tone: WinnerRow["tone"];
    if (cls.tag === "Result" && chance !== null) {
      statusText = `Won · ${chance}% sure`;
      tone = "won";
    } else if (cls.tag === "Leading" && chance !== null) {
      statusText = `Leading · ${chance}% sure`;
      tone = "leading";
    } else if (d.cards.length < 2) {
      statusText = "Collecting data";
      tone = "muted";
    } else {
      statusText = "Too close to call";
      tone = "muted";
    }
    return {
      deckId: d.id,
      index: d.index,
      label: d.label,
      text: d.leaderText ?? (tone === "muted" ? "No clear winner yet" : d.label),
      screens: d.variable === "productUI",
      statusText,
      tone,
      chancePct: chance,
    };
  });
}

/* Wording -------------------------------------------------------------------------- */

interface InsightSpec {
  id: string;
  kind: "result" | "lead";
  classification: Classification;
  groupSize: number;
  /** Fact keys the wording may cite. */
  facts: string[];
  outline: string;
  sourceTemplate: string;
  fallback: { title: string; text: string };
  /** Decks the insight names, for the model to see which winners it may connect. */
  decks: { id: string; label: string; text: string | null }[];
}

interface Wording {
  title: string;
  text: string;
}

async function askModel(provider: LlmProvider, spec: InsightSpec, table: SourceTable): Promise<Wording | null> {
  try {
    const raw = ai as unknown as { SYSTEM_RULES?: string };
    const reply = await provider.complete({
      task: WORDING_TASK,
      system: raw.SYSTEM_RULES ?? "Code fills every number. Cite figures only as {key} placeholders.",
      user: JSON.stringify({
        instruction:
          'Write a short title and one or two plain sentences for the outline. Cite every figure with a {key} placeholder from FACTS. Do not say winners from separate tests were tested together.',
        kind: spec.kind,
        outline: spec.outline,
        facts: spec.facts.map((key) => ({ key, label: table.get(key).label ?? key })),
        decks: spec.decks,
        output: '{"title":"...","text":"..."}',
      }),
      maxTokens: 400,
    });
    const parsed = extractJson(reply.text);
    const title = typeof parsed?.title === "string" ? parsed.title.trim() : "";
    const text = typeof parsed?.text === "string" ? parsed.text.trim() : "";
    if (!title || !text || title.length > MAX_TITLE || text.length > MAX_TEXT) return null;
    if (BANNED_WORDING.test(title) || BANNED_WORDING.test(text)) return null;
    return { title, text };
  } catch {
    // A provider error must never break the page: the template takes over.
    return null;
  }
}

/** Runs wording through the number rules. Returns the card text or the reason it was refused. */
function checkWording(spec: InsightSpec, table: SourceTable, w: Wording): { title: string; result: Extract<InsightResult, { ok: true }> } | null {
  const title = checkAndFill(w.title, table, spec.facts);
  if (!title.ok) return null;
  const result = ai.buildInsight({
    draft: { classification: spec.classification, outline: spec.outline, facts: spec.facts, sourceTemplate: spec.sourceTemplate },
    table,
    wordedText: w.text,
  });
  if (!result.ok) return null;
  return { title: title.text, result };
}

interface BuiltInsight {
  spec: InsightSpec;
  result: Extract<InsightResult, { ok: true }>;
  title: string;
  worded: "model" | "template";
}

async function buildOne(provider: LlmProvider, spec: InsightSpec, table: SourceTable): Promise<BuiltInsight | null> {
  const model = await askModel(provider, spec, table);
  if (model) {
    const checked = checkWording(spec, table, model);
    if (checked) return { spec, result: checked.result, title: checked.title, worded: "model" };
  }
  const checked = checkWording(spec, table, spec.fallback);
  if (checked) return { spec, result: checked.result, title: checked.title, worded: "template" };
  return null;
}

/* Insight specs --------------------------------------------------------------------- */

function resultSpec(decks: DeckFacts[], facts: SourceFact[]): InsightSpec | null {
  const allWinners = decks.filter((d) => classifyDeck(d).tag === "Result");
  // The Result is about what people said, so it reads the winners that have comments (design web 25: "decks 1 and 2 · 438
  // swipers · 41 comments"). With fewer than two decks of comments it falls back to every winner. A choice, not a spec rule.
  const withComments = allWinners.filter((d) => d.comments > 0);
  const winners = withComments.length >= 2 ? withComments : allWinners;
  if (winners.length < 2) return null;
  const swipers = winners.reduce((n, d) => n + d.swipers, 0);
  const comments = winners.reduce((n, d) => n + d.comments, 0);
  facts.push(
    fact("res.count", "Tests with a clear winner", allWinners.length, plural(allWinners.length, "test", "tests")),
    fact("res.swipers", "Swipers across those tests", swipers, plural(swipers, "swiper", "swipers")),
    fact("min", "Chance needed for a Result", MIN_PCT, `${MIN_PCT}%`),
  );
  const keys = ["res.count", "res.swipers", "min"];
  if (comments > 0) {
    facts.push(fact("res.comments", "Comments on those tests", comments, plural(comments, "comment", "comments")));
    keys.push("res.comments");
  }
  for (const d of winners) {
    keys.push(`${k(d)}.n`, `${k(d)}.chance`);
  }
  const names = listPhrase(winners.map((d) => place(`${k(d)}.n`)));
  const chances = listPhrase(winners.map((d) => place(`${k(d)}.chance`)));
  const source = `${winners.length === 1 ? "Test" : "Tests"} ${names} · ${place("res.swipers")} · Flagsmith: ${chances} chance best${comments > 0 ? ` · ${place("res.comments")}` : ""}`;
  return {
    id: "result-across-decks",
    kind: "result",
    classification: { tag: "Result", counted: true, reasons: [] } as unknown as Classification,
    groupSize: swipers,
    facts: keys,
    outline: "What the winning versions of these finished tests have in common, if anything. Each test was tested on its own.",
    sourceTemplate: source,
    fallback: {
      title: "Your finished tests have clear winners",
      text: `${place("res.count")} reached a clear winner, at ${place("min")} or more chance of being best. Each was tested on its own, so the winners were not tested against each other.`,
    },
    decks: winners.map((d) => ({ id: d.id, label: d.label, text: d.leaderText })),
  };
}

function targetLeadSpec(d: DeckFacts, facts: SourceFact[]): InsightSpec | null {
  if (d.targetSwipers === null || d.leaderChancePct === null || d.leaderText === null) return null;
  const cls = classifyDeck(d);
  if (cls.tag !== "Leading") return null;
  const group = ai.classifySegment({ swipers: d.targetSwipers });
  if (group.tag !== "Lead") return null; // under 10 swipers: hidden
  const deckKey = k(d);
  const leader = leaderRef(d, facts);
  facts.push(
    fact(`${deckKey}.target`, `${d.label} target users`, d.targetSwipers, plural(d.targetSwipers, "target user", "target users")),
    fact("min", "Chance needed for a Result", MIN_PCT, `${MIN_PCT}%`),
  );
  return {
    id: `lead-target-${d.id}`,
    kind: "lead",
    classification: group,
    groupSize: d.targetSwipers,
    facts: [`${deckKey}.n`, `${deckKey}.chance`, `${deckKey}.target`, "min", ...(leader.startsWith("{") ? [`${deckKey}.leader`] : [])],
    outline: `The ${d.noun} test is still running and one version leads, below the chance needed for a Result. Target users are a segment, so this is a Lead.`,
    sourceTemplate: `Test ${place(`${deckKey}.n`)}, still running · ${place(`${deckKey}.target`)} · Flagsmith: ${place(`${deckKey}.chance`)}, not decided`,
    fallback: {
      title: `The ${d.noun} test is still open`,
      text: `${leader} leads with ${place(`${deckKey}.chance`)} chance of being best, below the ${place("min")} needed. ${place(`${deckKey}.target`)} have swiped so far, so keep it running before you lock a ${d.noun}.`,
    },
    decks: [{ id: d.id, label: d.label, text: d.leaderText }],
  };
}

function stateLeadSpec(d: DeckFacts, facts: SourceFact[]): InsightSpec | null {
  const s = d.topState;
  if (!s || s.joined === 0) return null;
  const group = ai.classifySegment({ swipers: s.swipers });
  if (group.tag !== "Lead") return null;
  const deckKey = k(d);
  const rate = Math.round((s.joined / s.swipers) * 100);
  facts.push(
    fact(`${deckKey}.state.swipers`, `${s.label} swipers`, s.swipers, int(s.swipers)),
    fact(`${deckKey}.state.joined`, `${s.label} joined`, s.joined, int(s.joined)),
    fact(`${deckKey}.state.rate`, `${s.label} join rate`, rate, `${rate}%`),
  );
  return {
    id: `lead-state-${d.id}`,
    kind: "lead",
    classification: group,
    groupSize: s.swipers,
    facts: [`${deckKey}.n`, `${deckKey}.state.swipers`, `${deckKey}.state.joined`, `${deckKey}.state.rate`],
    outline: `One state group joins the waitlist most on the ${d.noun} test. A state is a segment, so this is a Lead.`,
    sourceTemplate: `Test ${place(`${deckKey}.n`)} · ${place(`${deckKey}.state.swipers`)} swipers in ${s.label} · a lead, not a result`,
    fallback: {
      title: `${s.label} joins the most`,
      text: `In ${s.label}, ${place(`${deckKey}.state.joined`)} of ${place(`${deckKey}.state.swipers`)} swipers joined (${place(`${deckKey}.state.rate`)}). A small group: confirm with a test before you rely on it.`,
    },
    decks: [{ id: d.id, label: d.label, text: d.leaderText }],
  };
}

/* Fact table -------------------------------------------------------------------------- */

function baseFacts(decks: DeckFacts[]): SourceFact[] {
  const facts: SourceFact[] = [];
  for (const d of decks) {
    const key = k(d);
    facts.push(fact(`${key}.n`, `${d.label} test number`, d.index, String(d.index)));
    facts.push(fact(`${key}.swipers`, `${d.label} swipers`, d.swipers, plural(d.swipers, "swiper", "swipers")));
    const chance = bestChance(d);
    if (chance !== null) facts.push(fact(`${key}.chance`, `${d.label} Flagsmith chance to be best`, chance, `${chance}%`));
  }
  return facts;
}

function dedupe(facts: SourceFact[]): SourceFact[] {
  const seen = new Set<string>();
  return facts.filter((f) => (seen.has(f.key) ? false : (seen.add(f.key), true)));
}

/* Comment themes ----------------------------------------------------------------------- */

export interface CommentSet {
  deckId: string;
  deckLabel: string;
  comments: { id: string; text: string }[];
}

async function themesFor(provider: LlmProvider, set: CommentSet): Promise<ThemeGroup | null> {
  const comments = set.comments.slice(0, MAX_THEME_COMMENTS).map((c) => ({ id: c.id, text: c.text.slice(0, 200) }));
  if (comments.length < MIN_THEME_COMMENTS) return null;
  const svc = ai as unknown as {
    swipeThemesPrompt(input: { card: string; comments: { id: string; text: string }[] }): { task: string; system: string; user: string; maxTokens?: number };
    applyThemeCounts(themes: unknown, comments: { id: string }[]): { label: string; commentIds: string[]; count: number }[];
  };
  try {
    const reply = await provider.complete(svc.swipeThemesPrompt({ card: set.deckLabel, comments }));
    const parsed = extractJson(reply.text);
    const counted = svc.applyThemeCounts(parsed?.themes, comments);
    // Labels are the model's words: no digits, no placeholders, short. Counts are code's.
    const themes = counted
      .filter((t) => t.label.length > 0 && t.label.length <= MAX_THEME_LABEL && !/[\d{}]/.test(t.label) && !BANNED_WORDING.test(t.label))
      .slice(0, 3)
      .map((t) => ({ label: t.label, count: t.count, countText: `${t.count} of ${comments.length} comments` }));
    if (themes.length === 0) return null;
    return { deckId: set.deckId, deckLabel: set.deckLabel, commentTotal: comments.length, themes };
  } catch {
    return null;
  }
}

/* Persona ------------------------------------------------------------------------------ */

export function personaCard(p: PersonaInput): PersonaCardView {
  const picks = [...p.picks].sort((a, b) => b.count - a.count);
  const pickText = picks.map((x) => `${x.key} ${x.count}`).join(", ");
  return {
    tags: ["Simulated", "Unproven"],
    title: "AI persona pre-test",
    text: `${p.totalPersonas} simulated personas (${p.personasPerCard} per card) picked: ${pickText}. These are AI guesses, not swipes.`,
    trackRecord: p.finished === 0 ? "No finished tests to compare with yet" : `Right in ${p.right} of ${p.finished} finished tests`,
    footnote: "Never counted with real swipes and never used in the insights above.",
  };
}

/* Suggestion --------------------------------------------------------------------------- */

export function suggestNext(productId: string, decks: DeckFacts[], text?: string | null): SuggestionView | null {
  const tested = new Set(decks.map((d) => d.variable));
  const next = TEST_VARIABLES.find((v) => !tested.has(v));
  if (!next) return null;
  const href = `/decks/new?product=${encodeURIComponent(productId)}`;
  return {
    variable: next,
    text: text ?? `${TEST_VARIABLE_LABELS[next]}: not tested yet. Change only this one thing.`,
    href,
  };
}

/* Page --------------------------------------------------------------------------------- */

export interface BuildInput {
  productId: string;
  productName: string;
  productIcon: string;
  accent: "green" | "blue" | "purple";
  anchorDeckId: string | null;
  decks: DeckFacts[];
  commentSets?: CommentSet[];
  persona?: PersonaInput | null;
  suggestionText?: string | null;
  provider: LlmProvider;
  now?: Date;
  /** Distinct swipers across the decks, when known. Otherwise the decks' counted swipes are summed. */
  distinctSwipers?: number;
}

export async function buildInsights(input: BuildInput): Promise<InsightsPayload> {
  const { decks, provider } = input;
  const notes: string[] = [];

  const facts = baseFacts(decks);
  const specs: InsightSpec[] = [];
  const result = resultSpec(decks, facts);
  if (result) specs.push(result);
  for (const d of decks) {
    const t = targetLeadSpec(d, facts);
    if (t) specs.push(t);
    const s = stateLeadSpec(d, facts);
    if (s) specs.push(s);
  }
  const table = buildFactTable(dedupe(facts));

  const built = (await Promise.all(specs.map((s) => buildOne(provider, s, table)))).filter((b): b is BuiltInsight => {
    return b !== null;
  });
  if (built.length < specs.length) notes.push("Hid an insight: its numbers could not be checked against your results.");

  // Page rules: every Result stays; at most two Leads, largest groups first.
  const page = ai.applyPageLimits(built.map((b) => b.result));
  const shown = new Set(page.shown);
  if (page.hidden.some((h) => h.reason === "page lead limit")) notes.push(`Showing the ${LIMITS_LEADS} largest Leads; smaller ones are hidden.`);

  const insights: InsightCardView[] = built
    .filter((b) => shown.has(b.result))
    .sort((a, b) => (a.spec.kind === b.spec.kind ? b.spec.groupSize - a.spec.groupSize : a.spec.kind === "result" ? -1 : 1))
    .map((b) => ({
      id: b.spec.id,
      tag: b.spec.kind === "result" ? "Result" : "Lead",
      tagLabel: b.result.tagLabel,
      title: b.title,
      body: b.result.text,
      sourceLine: b.result.sourceLine,
      worded: b.worded,
    }));

  const totals = decks.reduce(
    (t, d) => ({ swipers: t.swipers + d.swipers, saidYes: t.saidYes + d.saidYes, joined: t.joined + d.joined, waitlist: t.waitlist + d.waitlist }),
    { swipers: 0, saidYes: 0, joined: 0, waitlist: 0 },
  );
  const winners = winnerRows(decks);

  const themes: ThemeGroup[] = [];
  for (const set of (input.commentSets ?? []).slice(0, MAX_THEME_GROUPS)) {
    const g = await themesFor(provider, set);
    if (g) themes.push(g);
  }

  return {
    productId: input.productId,
    productName: input.productName,
    productIcon: input.productIcon,
    accent: input.accent,
    anchorDeckId: input.anchorDeckId,
    deckCount: decks.length,
    swipers: input.distinctSwipers ?? totals.swipers,
    swipersAreDistinct: input.distinctSwipers !== undefined,
    waitlist: totals.waitlist,
    winnerCount: winners.filter((w) => w.tone === "won").length,
    winners,
    insights,
    saidYesVsActed: totals.swipers > 0 ? saidYesVsActed(totals) : null,
    themes,
    persona: input.persona ? personaCard(input.persona) : null,
    suggestion: suggestNext(input.productId, decks, input.suggestionText),
    notes,
    provider: provider.name,
    generatedAt: (input.now ?? new Date()).toISOString(),
  };
}

const LIMITS_LEADS = ai.THRESHOLDS.maxLeadsPerPage;
