/**
 * The tools the chat can call (spec 05 section 6.7): get_results, get_segments, get_experiment,
 * get_comments (+ get_price_curve and draft_deck). They READ the WP7 results payloads and DRAFT a
 * deck. There is no tool that publishes, ships, stops a test or changes a flag, and none can be
 * added by the model: the loop only runs tools listed in ASK_TOOLS.
 *
 * Every figure a tool returns is also returned as a fact (key + exact display text). The model
 * writes {fact.key} placeholders; code fills them and re-checks (src/shared/lib/ai/rules.ts).
 */
import { ai, factSlug, type SourceFact, type ToolDef, type ToolOutput } from "@/shared/lib/ai";
import { ROLES, STATES, TEST_VARIABLES, TEST_VARIABLE_LABELS, type TestVariable } from "@/shared/lib/lists";
import type { ResultsPayload, SegmentRowView, SegmentView } from "@/features/results/types";

import type { AskToolCtx, CommentRow, DeckInContext } from "../types";

export const SEGMENT_BY = ["state", "source", "interest", "target"] as const;
export type SegmentBy = (typeof SEGMENT_BY)[number];

const BY_LABEL: Record<SegmentBy, string> = {
  state: "state",
  source: "source",
  interest: "interest",
  target: "target users",
};

const int = (n: number) => n.toLocaleString("en-US");
const pctOf = (fraction: number) => Math.round(fraction * 100);
const fact = (key: string, label: string, value: number, display: string): SourceFact => ({ key, label, value, display });

/* Deck lookup ---------------------------------------------------------------- */

export function resolveDeck(ctx: AskToolCtx, arg: unknown): DeckInContext {
  const wanted = typeof arg === "string" ? arg.trim() : "";
  if (!wanted) return ctx.decks[ctx.currentDeckId];
  if (ctx.decks[wanted]) return ctx.decks[wanted];
  const lower = wanted.toLowerCase();
  const found = Object.values(ctx.decks).find(
    (d) =>
      d.payload.deck.variable.toLowerCase() === lower ||
      d.label.toLowerCase().includes(lower) ||
      d.id.toLowerCase() === lower,
  );
  if (found) return found;
  const list = Object.values(ctx.decks)
    .map((d) => `${d.id} (${d.label})`)
    .join(", ");
  throw new Error(`Unknown deck "${wanted}". Decks of this product: ${list}.`);
}

const callText = (name: string, parts: Record<string, string | undefined>) =>
  `${name}(${Object.entries(parts)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(", ")})`;

/* get_results ------------------------------------------------------------------ */

export interface ResultsToolResult {
  deckId: string;
  deck: string;
  totals: { swipers: number; saidYes: number; joined: number };
  cards: {
    key: string;
    label: string;
    valueText: string;
    swipers: number;
    saidYes: number;
    joined: number;
    /** Percent with one decimal, joined / swipers. */
    joinRatePct: number;
    chanceBestPct: number | null;
  }[];
}

const getResults: ToolDef<AskToolCtx> = {
  name: "get_results",
  description: "Swipers, said yes and joined per card, with totals, for one deck.",
  args: '{"deck"?: deck id or name}',
  async run(args, ctx, ref): Promise<ToolOutput> {
    const d = resolveDeck(ctx, args.deck);
    const p = d.payload;
    const facts: SourceFact[] = [
      fact(`${ref}.total.swipers`, "Swipers", p.totals.swipers, int(p.totals.swipers)),
      fact(`${ref}.total.saidYes`, "Said yes", p.totals.saidYes, int(p.totals.saidYes)),
      fact(`${ref}.total.joined`, "Joined", p.totals.joined, int(p.totals.joined)),
    ];
    const cards: ResultsToolResult["cards"] = p.leaderboard.everyone.map((r) => {
      const swipers = r.swipers ?? 0;
      const joined = r.joined ?? 0;
      const rate = swipers > 0 ? Number(((joined / swipers) * 100).toFixed(1)) : 0;
      const chance = r.chanceBest === null ? null : pctOf(r.chanceBest);
      const k = `${ref}.${factSlug(r.key)}`;
      facts.push(
        fact(`${k}.swipers`, `${r.label} swipers`, swipers, int(swipers)),
        fact(`${k}.saidYes`, `${r.label} said yes`, r.saidYes ?? 0, int(r.saidYes ?? 0)),
        fact(`${k}.joined`, `${r.label} joined`, joined, int(joined)),
        fact(`${k}.joinRate`, `${r.label} join rate`, rate, `${rate.toFixed(1)}%`),
      );
      if (chance !== null) facts.push(fact(`${k}.chance`, `${r.label} Flagsmith chance to be best`, chance, `${chance}%`));
      return { key: r.key, label: r.label, valueText: r.valueText, swipers, saidYes: r.saidYes ?? 0, joined, joinRatePct: rate, chanceBestPct: chance };
    });
    const result: ResultsToolResult = {
      deckId: d.id,
      deck: d.label,
      totals: { swipers: p.totals.swipers, saidYes: p.totals.saidYes, joined: p.totals.joined },
      cards,
    };
    return { result, facts, summary: `Compared the ${p.deck.noun}s`, call: callText("get_results", { deck: d.id }) };
  },
};

/* get_segments ----------------------------------------------------------------- */

export interface SegmentsToolResult {
  deckId: string;
  deck: string;
  by: SegmentBy;
  /** Segments are always Leads, never Results (rule 4). */
  tag: "Lead";
  rows: { key: string; label: string; swipers: number; saidYes: number; joined: number; joinRatePct: number }[];
  /** Groups under 10 swipers, merged. Numbers only when the merged group has 10 or more. */
  other: { groups: number; swipers: number | null; joined: number | null; joinRatePct: number | null } | null;
  overall: { swipers: number; saidYes: number; joined: number; joinRatePct: number };
  /** Groups counted for the Lead line: shown groups, plus one for Other. */
  groupCount: number;
  overlapping: boolean;
}

function segmentView(p: ResultsPayload, by: SegmentBy): { view: SegmentView; rows: SegmentRowView[] } {
  const w = p.whoSwiped;
  switch (by) {
    case "state":
      return { view: w.location, rows: w.location.rows };
    case "source":
      return { view: w.source, rows: w.source.rows };
    case "interest":
      return { view: w.interests, rows: w.interests.rows };
    case "target": {
      const t = w.target;
      const rows = t.enough && t.target && t.everyone ? [{ ...t.target, label: "Target users" }, { ...t.everyone, label: "Everyone else" }] : [];
      return { view: { ...w.location, rows, other: null, otherVisible: false, groupCount: rows.length, overlapping: false }, rows };
    }
  }
}

const getSegments: ToolDef<AskToolCtx> = {
  name: "get_segments",
  description:
    "The same split by state, source, interest or target users. Groups under 10 swipers are never listed (they are merged into Other). Segment findings are Leads.",
  args: '{"deck"?: deck id or name, "by": "state" | "source" | "interest" | "target"}',
  async run(args, ctx, ref): Promise<ToolOutput> {
    const d = resolveDeck(ctx, args.deck);
    const by = args.by as SegmentBy;
    if (!SEGMENT_BY.includes(by)) throw new Error(`"by" must be one of: ${SEGMENT_BY.join(", ")}.`);
    const { view, rows } = segmentView(d.payload, by);
    const facts: SourceFact[] = [];
    const outRows: SegmentsToolResult["rows"] = rows.map((r) => {
      const rate = pctOf(r.joinRate);
      const k = `${ref}.${factSlug(r.label)}`;
      facts.push(
        fact(`${k}.swipers`, `${r.label} swipers`, r.swipers, int(r.swipers)),
        fact(`${k}.saidYes`, `${r.label} said yes`, r.saidYes, int(r.saidYes)),
        fact(`${k}.joined`, `${r.label} joined`, r.joined, int(r.joined)),
        fact(`${k}.joinRate`, `${r.label} join rate`, rate, `${rate}%`),
      );
      return { key: r.key, label: r.label, swipers: r.swipers, saidYes: r.saidYes, joined: r.joined, joinRatePct: rate };
    });
    const o = view.overall;
    const overallRate = pctOf(o.rate);
    facts.push(
      fact(`${ref}.overall.swipers`, "All swipers", o.swipers, int(o.swipers)),
      fact(`${ref}.overall.joined`, "All joined", o.joined, int(o.joined)),
      fact(`${ref}.overall.joinRate`, "Overall join rate", overallRate, `${overallRate}%`),
    );
    let other: SegmentsToolResult["other"] = null;
    if (view.other) {
      const visible = view.otherVisible;
      const rate = visible && view.other.swipers > 0 ? pctOf(view.other.joined / view.other.swipers) : null;
      other = {
        groups: view.other.groupCount,
        swipers: visible ? view.other.swipers : null,
        joined: visible ? view.other.joined : null,
        joinRatePct: rate,
      };
      if (visible) facts.push(fact(`${ref}.other.swipers`, "Other swipers", view.other.swipers, int(view.other.swipers)));
    }
    facts.push(fact(`${ref}.groups`, "Groups", view.groupCount, int(view.groupCount)));
    const result: SegmentsToolResult = {
      deckId: d.id,
      deck: d.label,
      by,
      tag: "Lead",
      rows: outRows,
      other,
      overall: { swipers: o.swipers, saidYes: o.saidYes, joined: o.joined, joinRatePct: overallRate },
      groupCount: view.groupCount,
      overlapping: view.overlapping,
    };
    return {
      result,
      facts,
      summary: `Looked up results by ${BY_LABEL[by]}`,
      call: callText("get_segments", { deck: d.id, by }),
    };
  },
};

/* get_experiment ----------------------------------------------------------------- */

export interface ExperimentToolResult {
  deckId: string;
  deck: string;
  statusLabel: string;
  /** False when Flagsmith could not be read. Then there is no chance to quote. */
  available: boolean;
  verdictKind: string;
  headline: string;
  leaderLabel: string | null;
  leaderChancePct: number | null;
  cards: { key: string; label: string; identities: number | null; chanceBestPct: number | null }[];
  srmWarning: boolean | null;
  minutesAgo: number | null;
  /** Result only when the test is decided by Flagsmith's rules (95%, 50 identities, no SRM warning). */
  tag: string | null;
  tagLabel: string | null;
  reasons: string[];
}

const getExperiment: ToolDef<AskToolCtx> = {
  name: "get_experiment",
  description: "Flagsmith chance to be best, identities per card, sample-ratio warning, last refresh time, and whether the test is decided.",
  args: '{"deck"?: deck id or name}',
  async run(args, ctx, ref): Promise<ToolOutput> {
    const d = resolveDeck(ctx, args.deck);
    const p = d.payload;
    const fl = await ctx.experiment(d.id);
    const facts: SourceFact[] = [];
    const label = (key: string) => p.leaderboard.everyone.find((r) => r.key === key)?.label ?? key;

    const cards: ExperimentToolResult["cards"] = fl
      ? fl.cards.map((c) => ({ key: c.variantKey, label: label(c.variantKey), identities: c.identities, chanceBestPct: pctOf(c.chanceToBeatControl) }))
      : p.leaderboard.everyone.map((r) => ({ key: r.key, label: r.label, identities: null, chanceBestPct: r.chanceBest === null ? null : pctOf(r.chanceBest) }));
    for (const c of cards) {
      const k = `${ref}.${factSlug(c.key)}`;
      if (c.chanceBestPct !== null) facts.push(fact(`${k}.chance`, `${c.label} Flagsmith chance to be best`, c.chanceBestPct, `${c.chanceBestPct}%`));
      if (c.identities !== null) facts.push(fact(`${k}.identities`, `${c.label} identities`, c.identities, int(c.identities)));
    }
    const leaderChance = p.verdict.chance === null ? null : pctOf(p.verdict.chance);
    if (leaderChance !== null) facts.push(fact(`${ref}.leader.chance`, "Leader chance to be best", leaderChance, `${leaderChance}%`));
    if (p.assistant.minutesAgo !== null) facts.push(fact(`${ref}.minutes`, "Minutes since last check", p.assistant.minutesAgo, `${p.assistant.minutesAgo} min`));

    let tag: string | null = null;
    let reasons: string[] = [];
    if (fl) {
      const decided = p.verdict.kind === "decided";
      const cls = ai.classifyExperiment({
        source: "flagsmith",
        status: decided ? "decided" : "live",
        srmWarning: fl.srmWarning,
        cards: fl.cards.map((c) => ({ id: c.variantKey, chancePct: c.chanceToBeatControl * 100, identities: c.identities })),
      });
      tag = cls.tag;
      reasons = cls.reasons;
      // The Results screen verdict (rule 3) is the source of truth: never a Result unless it says decided.
      if (tag === "Result" && !decided) tag = "Leading";
      if (p.verdict.kind === "too_close") tag = "Inconclusive";
    }
    const result: ExperimentToolResult = {
      deckId: d.id,
      deck: d.label,
      statusLabel: p.deck.statusLabel,
      available: fl !== null,
      verdictKind: p.verdict.kind,
      headline: p.verdict.headline,
      leaderLabel: p.verdict.leaderLabel,
      leaderChancePct: leaderChance,
      cards,
      srmWarning: fl ? fl.srmWarning : null,
      minutesAgo: p.assistant.minutesAgo,
      tag,
      tagLabel: tag ? ai.TAG_LABELS[tag as keyof typeof ai.TAG_LABELS] : null,
      reasons,
    };
    const what = p.deck.variable === "price" ? "price test" : `${p.deck.noun} test`;
    return { result, facts, summary: `Checked the ${what}`, call: callText("get_experiment", { deck: d.id }) };
  },
};

/* get_price_curve --------------------------------------------------------------- */

export interface PriceToolResult {
  deckId: string;
  deck: string;
  verdict: "result" | "lead";
  headline: string;
  bestKey: string | null;
  rows: {
    key: string;
    priceLabel: string;
    priceShort: string;
    price: number;
    joinedPct: number;
    joinedLowPct: number;
    joinedHighPct: number;
    revenueText: string;
    chancePct: number;
    isBest: boolean;
    joinedOfText: string;
  }[];
  totalSwipers: number;
}

const getPriceCurve: ToolDef<AskToolCtx> = {
  name: "get_price_curve",
  description: "Join rate and revenue per price with ranges, and the chance each price earns most. Only for find-the-best-price decks.",
  args: '{"deck"?: deck id or name}',
  async run(args, ctx, ref): Promise<ToolOutput> {
    const d = resolveDeck(ctx, args.deck);
    const c = d.payload.priceCurve;
    if (!c) throw new Error(`Deck ${d.id} (${d.label}) has no price curve. Try another deck of this product.`);
    const facts: SourceFact[] = [fact(`${ref}.total.swipers`, "Swipers across prices", c.totals.swipers, int(c.totals.swipers))];
    const rows: PriceToolResult["rows"] = c.rows.map((r) => {
      const k = `${ref}.${factSlug(r.key)}`;
      facts.push(
        fact(`${k}.price`, `${r.priceShort} price`, r.price, r.priceShort),
        fact(`${k}.joinRate`, `${r.priceShort} join rate`, r.joinedPct, `${r.joinedPct}%`),
        fact(`${k}.chance`, `${r.priceShort} chance it earns most`, r.chancePct, `${r.chancePct}%`),
      );
      return {
        key: r.key,
        priceLabel: r.priceLabel,
        priceShort: r.priceShort,
        price: r.price,
        joinedPct: r.joinedPct,
        joinedLowPct: r.joinedLowPct,
        joinedHighPct: r.joinedHighPct,
        revenueText: r.revenueText,
        chancePct: r.chancePct,
        isBest: r.isBest,
        joinedOfText: r.joinedOfText,
      };
    });
    const result: PriceToolResult = {
      deckId: d.id,
      deck: d.label,
      verdict: c.verdict,
      headline: c.headline,
      bestKey: c.bestKey,
      rows,
      totalSwipers: c.totals.swipers,
    };
    return { result, facts, summary: "Checked the price curve", call: callText("get_price_curve", { deck: d.id }) };
  },
};

/* get_comments ------------------------------------------------------------------ */

export interface CommentsToolResult {
  deckId: string;
  deck: string;
  card: { key: string; label: string; swipers: number; chanceBestPct: number | null } | null;
  total: number;
  voice: number;
  /** At most MAX_COMMENTS, newest first. Voice notes carry the English translation. */
  comments: (CommentRow & { quote: string })[];
}

export const MAX_COMMENTS = 8;

export function commentMeta(c: CommentRow): string {
  const parts: string[] = [];
  if (c.kind === "voice") {
    const s = c.seconds ?? 0;
    parts.push(`${c.language ?? "Voice"} voice note`, `0:${String(s).padStart(2, "0")}`, "translated");
  } else {
    parts.push("Typed");
  }
  if (c.state) parts.push(c.state);
  if (c.role) parts.push(c.role);
  return parts.join(" · ");
}

const getComments: ToolDef<AskToolCtx> = {
  name: "get_comments",
  description: "Typed and voice comments (voice notes are translated to English) with the swiper's state and role. Optional filter by card and language.",
  args: '{"deck"?: deck id or name, "card"?: card key such as "C", "language"?: "English" | "Hindi" | ...}',
  async run(args, ctx, ref): Promise<ToolOutput> {
    const d = resolveDeck(ctx, args.deck);
    const rows = d.payload.leaderboard.everyone;
    const cardArg = typeof args.card === "string" ? args.card.trim().toLowerCase() : "";
    const card = cardArg ? rows.find((r) => r.key.toLowerCase() === cardArg || r.label.toLowerCase() === cardArg) : undefined;
    if (cardArg && !card) throw new Error(`Unknown card "${args.card}". Cards: ${rows.map((r) => r.key).join(", ")}.`);
    const lang = typeof args.language === "string" ? args.language.trim().toLowerCase() : "";

    let all = await ctx.comments(d.id);
    if (card) all = all.filter((c) => c.cardKey === card.key);
    if (lang) all = all.filter((c) => (c.language ?? "english").toLowerCase() === lang);

    const voice = all.filter((c) => c.kind === "voice").length;
    const facts: SourceFact[] = [
      fact(`${ref}.count`, "Comments", all.length, `${int(all.length)} ${all.length === 1 ? "comment" : "comments"}`),
      fact(`${ref}.voice`, "Voice comments", voice, `${int(voice)} by voice`),
    ];
    let cardInfo: CommentsToolResult["card"] = null;
    if (card) {
      const chance = card.chanceBest === null ? null : pctOf(card.chanceBest);
      cardInfo = { key: card.key, label: card.label, swipers: card.swipers ?? 0, chanceBestPct: chance };
      facts.push(fact(`${ref}.card.swipers`, `${card.label} swipers`, card.swipers ?? 0, int(card.swipers ?? 0)));
      if (chance !== null) facts.push(fact(`${ref}.card.chance`, `${card.label} Flagsmith chance to be best`, chance, `${chance}%`));
    }
    const result: CommentsToolResult = {
      deckId: d.id,
      deck: d.label,
      card: cardInfo,
      total: all.length,
      voice,
      comments: all.slice(0, MAX_COMMENTS).map((c) => ({ ...c, quote: c.text })),
    };
    const where = card ? `on ${card.key}` : "on every card";
    return {
      result,
      facts,
      summary: `Read comments ${where}${voice > 0 ? ", including voice notes" : ""}`,
      call: callText("get_comments", { deck: d.id, card: card?.key, language: lang ? String(args.language) : undefined }),
    };
  },
};

/* draft_deck -------------------------------------------------------------------- */

export interface DraftToolResult {
  /** Always false: the chat cannot publish. The founder reviews the draft and publishes it themselves. */
  published: false;
  title: string;
  variable: TestVariable;
  versions: string[];
  roles: string[];
  state: string | null;
  locked: string | null;
  lockNote: string | null;
}

const DRAFTABLE: TestVariable[] = ["headline", "description", "reward", "price", "language"];
const MAX_VERSION_LENGTH = 80;

const draftDeck: ToolDef<AskToolCtx> = {
  name: "draft_deck",
  description:
    "Drafts a one-variable deck for the founder to review. Never publishes. Price drafts use the price ladder of the product's existing price deck (code supplies the prices). Other variables need 2 to 4 short versions written in words, without digits.",
  args: '{"variable": "headline"|"description"|"reward"|"price"|"language", "versions"?: string[], "audience"?: role[], "state"?: state name, "lock_from_deck"?: deck id}',
  async run(args, ctx, ref): Promise<ToolOutput> {
    void ref;
    const variable = args.variable as TestVariable;
    if (!TEST_VARIABLES.includes(variable)) throw new Error(`"variable" must be one of: ${TEST_VARIABLES.join(", ")}.`);
    if (!DRAFTABLE.includes(variable)) throw new Error(`draft_deck can draft: ${DRAFTABLE.join(", ")}.`);

    let versions: string[];
    if (variable === "price") {
      const priced = Object.values(ctx.decks).find((d) => d.payload.priceCurve);
      const ladder = priced?.payload.priceCurve?.rows.slice().sort((a, b) => a.price - b.price).map((r) => r.priceShort) ?? [];
      if (ladder.length < 2) throw new Error("There is no price deck to take prices from. Ask the founder to add prices in the deck editor.");
      versions = ladder;
    } else {
      const given = Array.isArray(args.versions) ? args.versions.filter((v): v is string => typeof v === "string").map((v) => v.trim()) : [];
      if (given.length < 2 || given.length > 4) throw new Error('"versions" needs 2 to 4 short texts.');
      if (given.some((v) => v.length === 0 || v.length > MAX_VERSION_LENGTH)) throw new Error(`Each version must be 1 to ${MAX_VERSION_LENGTH} characters.`);
      if (given.some((v) => /\d/.test(v))) throw new Error("Write the versions in words without digits. Figures come from the data, not from you.");
      versions = given;
    }

    const targetRoles = ctx.decks[ctx.currentDeckId].payload.whoSwiped.target.roles;
    let roles = targetRoles;
    if (Array.isArray(args.audience) && args.audience.length > 0) {
      const asked = args.audience.filter((r): r is string => typeof r === "string");
      const bad = asked.filter((r) => !(ROLES as readonly string[]).includes(r));
      if (bad.length) throw new Error(`Unknown roles: ${bad.join(", ")}. Roles: ${ROLES.join(", ")}.`);
      roles = asked;
    }
    let state: string | null = null;
    if (typeof args.state === "string" && args.state.trim()) {
      if (!(STATES as readonly string[]).includes(args.state)) throw new Error(`Unknown state "${args.state}".`);
      state = args.state;
    }

    let locked: string | null = null;
    let lockNote: string | null = null;
    if (typeof args.lock_from_deck === "string" && args.lock_from_deck) {
      const src = resolveDeck(ctx, args.lock_from_deck);
      const v = src.payload.verdict;
      // Only a decided Result is carried into the next test; a lead is not.
      if (v.kind === "decided" && v.leaderLabel) locked = `${v.leaderLabel} on every card`;
      else lockNote = `${src.label} has no decided winner yet, so the cards keep the current wording.`;
    }

    const title = `${TEST_VARIABLE_LABELS[variable]} test${state ? ` · ${state}` : ""}${roles.length ? " · target users" : ""}`;
    const result: DraftToolResult = { published: false, title, variable, versions, roles, state, locked, lockNote };
    return {
      result,
      facts: [],
      summary: `Drafted a ${TEST_VARIABLE_LABELS[variable].toLowerCase()} test (not published)`,
      call: callText("draft_deck", { variable, state: state ?? undefined }),
    };
  },
};

/** The only tools the model can call. */
export const ASK_TOOLS: ToolDef<AskToolCtx>[] = [getResults, getSegments, getExperiment, getPriceCurve, getComments, draftDeck];
