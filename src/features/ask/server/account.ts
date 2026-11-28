/**
 * Account-scoped READ tools (server only). The signed-in uid is the only identity: every id the model passes
 * (a product, a test) is looked up through the decks services, which allow the owner or an active co-founder and nobody
 * else. Each tool returns data, a `card` for the chat UI, and facts for the number guard.
 */
import { CURRENT_PLAN, decksLeft } from "@/shared/lib/plans";
import type { SourceFact, ToolOutput } from "@/shared/lib/ai";
import { getOverview, getProduct, getDeck } from "@/features/decks/server/service";
import type { DecksOverview, ProductListItem, DeckListItem } from "@/features/decks/views";
import { APP_PAGES, TEST_TABS, matchAppPage, productHref, testHref } from "../app-map";
import { runCompute, COMPUTE_OPS, type ComputeArgs } from "../compute";
import type { ComparisonCard, KpiRowCard, PageLinkCard, ProductListCard, RenderedComponent, TestTableCard } from "../types";

/** Who is asking and from where. Built per request from the verified token and the client's page context. */
export interface Actor {
  ownerId: string;
  pathname: string;
  timeZone: string;
  baseUrl: string;
  /** The user's latest message: digits in drafted copy must come from it. */
  userText: string;
  theme?: { mode: "light" | "dark"; presetId: string };
  now?: () => Date;
}

export type AccountOutput = ToolOutput & { card?: RenderedComponent };

const MAX_ROWS = 20;
const int = (n: number) => n.toLocaleString("en-US");
const fact = (key: string, label: string, value: number, display = int(value)): SourceFact => ({ key, label, value, display });
const nowOf = (a: Actor) => (a.now ?? (() => new Date()))();
const objectIdTime = (id: string) => (/^[0-9a-f]{24}$/i.test(id) ? parseInt(id.slice(0, 8), 16) * 1000 : null);

/* Lookup helpers (shared with the action tools) ---------------------------------------- */

export class AmbiguousError extends Error {}

/** A product of this account by id or by name. Several matches: an error that lists them, so the model asks. */
export function findProduct(overview: DecksOverview, token: unknown): ProductListItem {
  const t = typeof token === "string" ? token.trim() : "";
  if (!t) throw new AmbiguousError("Which product? Ask the user.");
  const byId = overview.products.find((p) => p.id === t);
  if (byId) return byId;
  const lower = t.toLowerCase();
  const exact = overview.products.filter((p) => p.name.toLowerCase() === lower);
  const hits = exact.length ? exact : overview.products.filter((p) => p.name.toLowerCase().includes(lower));
  if (hits.length === 1) return hits[0];
  if (hits.length === 0) throw new AmbiguousError(`No product matches "${t.slice(0, 60)}". Products: ${overview.products.map((p) => p.name).join(", ") || "none"}.`);
  throw new AmbiguousError(`Several products match "${t.slice(0, 60)}": ${hits.map((p) => `${p.name} (${p.id})`).join(", ")}. Ask the user which one.`);
}

export function findTest(overview: DecksOverview, token: unknown, productToken?: unknown): { test: DeckListItem; product: ProductListItem } {
  const t = typeof token === "string" ? token.trim() : "";
  const all = overview.products.flatMap((p) => p.decks.map((test) => ({ test, product: p })));
  const scoped = productToken ? all.filter((x) => x.product.id === findProduct(overview, productToken).id) : all;
  if (!t) throw new AmbiguousError("Which test? Ask the user.");
  const byId = all.find((x) => x.test.id === t);
  if (byId) return byId;
  const lower = t.toLowerCase();
  const text = (x: (typeof all)[number]) => `${x.product.name} ${x.test.variable} ${x.test.label}`.toLowerCase();
  const hits = scoped.filter((x) => lower.split(/\s+/).every((w) => text(x).includes(w)));
  if (hits.length === 1) return hits[0];
  if (hits.length === 0) throw new AmbiguousError(`No test matches "${t.slice(0, 60)}".`);
  throw new AmbiguousError(`Several tests match "${t.slice(0, 60)}": ${hits.slice(0, 6).map((x) => `${x.product.name} ${x.test.label} (${x.test.statusLabel}, ${x.test.id})`).join("; ")}. Ask the user which one.`);
}

/* Current page ------------------------------------------------------------------------- */

export interface PageInfo {
  pathname: string;
  page: string;
  known: boolean;
  productId: string | null;
  productName: string | null;
  testId: string | null;
  testLabel: string | null;
  tab: string | null;
}

/** The page the user is on. An id in the path only counts when the signed-in user can open it. */
export async function resolvePage(actor: Pick<Actor, "ownerId" | "pathname">): Promise<PageInfo> {
  const path = actor.pathname.split("?")[0];
  const m = matchAppPage(path);
  const base: PageInfo = { pathname: path.slice(0, 200), page: m?.page.title ?? "Unknown page", known: Boolean(m), productId: null, productName: null, testId: null, testLabel: null, tab: null };
  if (!m?.id) return base;
  if (m.page.idKind === "product") {
    const p = await getProduct(actor.ownerId, m.id);
    if (p.ok) return { ...base, productId: p.value.id, productName: p.value.name };
  } else if (m.page.idKind === "test") {
    const d = await getDeck(actor.ownerId, m.id);
    if (d.ok) {
      const p = await getProduct(actor.ownerId, d.value.productId);
      const tab = TEST_TABS.find((t) => t.id === m.page.id || (m.page.id === "results" && t.id === "results"));
      return {
        ...base,
        productId: d.value.productId,
        productName: p.ok ? p.value.name : null,
        testId: d.value._id,
        testLabel: `${p.ok ? p.value.name : "Test"} ${d.value.variable}`,
        tab: tab?.label ?? null,
      };
    }
  }
  return base;
}

/** The deck id of the page, when the user may open it (for the server context of the results tools). */
export async function currentTestId(actor: Pick<Actor, "ownerId" | "pathname">): Promise<string | null> {
  return (await resolvePage(actor)).testId;
}

/* Tools -------------------------------------------------------------------------------------- */

const call = (name: string, parts: Record<string, unknown> = {}) =>
  `${name}(${Object.entries(parts).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ")})`;

export async function listProductsTool(_args: Record<string, unknown>, actor: Actor, ref: string): Promise<AccountOutput> {
  const overview = await getOverview(actor.ownerId);
  const facts: SourceFact[] = [];
  let tests = 0, live = 0, swipers = 0, waitlist = 0;
  const shown = overview.products.slice(0, MAX_ROWS);
  const items: ProductListCard["items"] = [];
  const data = overview.products.map((p, i) => {
    const pLive = p.decks.filter((d) => d.status === "live").length;
    const pSwipers = p.decks.reduce((n, d) => n + d.swipers, 0);
    tests += p.deckCount;
    live += pLive;
    swipers += pSwipers;
    waitlist += p.waitlist;
    const k = `${ref}.p${i + 1}`;
    if (i < MAX_ROWS) {
      facts.push(fact(`${k}.tests`, `${p.name}: tests`, p.deckCount), fact(`${k}.live`, `${p.name}: live tests`, pLive), fact(`${k}.swipers`, `${p.name}: swipers`, pSwipers), fact(`${k}.waitlist`, `${p.name}: waitlist`, p.waitlist));
      items.push({ id: p.id, name: p.name, href: productHref(p.id), role: p.role ?? "owner", tests: int(p.deckCount), live: int(pLive), swipers: int(pSwipers), waitlist: int(p.waitlist) });
    }
    return { id: p.id, name: p.name, role: p.role ?? "owner", category: p.category, factKey: k };
  });
  facts.unshift(
    fact(`${ref}.total.products`, "Products", overview.products.length),
    fact(`${ref}.total.tests`, "Tests", tests),
    fact(`${ref}.total.live`, "Live tests", live),
    fact(`${ref}.total.swipers`, "Swipes", swipers),
    fact(`${ref}.total.waitlist`, "Waitlist sign-ups", waitlist),
  );
  const card: ProductListCard = { kind: "productList", items, more: overview.products.length > shown.length ? `${overview.products.length - shown.length} more not shown` : null };
  return { summary: "Listed your products", call: call("list_products"), result: { products: data, note: "Facts per product use the factKey prefix: <factKey>.tests, .live, .swipers, .waitlist." }, facts, card };
}

const STATUSES = ["draft", "live", "decided", "shipped", "closed"] as const;

export async function listTestsTool(args: Record<string, unknown>, actor: Actor, ref: string): Promise<AccountOutput> {
  const overview = await getOverview(actor.ownerId);
  const product = args.product ? findProduct(overview, args.product) : null;
  const status = typeof args.status === "string" && (STATUSES as readonly string[]).includes(args.status) ? args.status : null;
  const rows = overview.products
    .filter((p) => !product || p.id === product.id)
    .flatMap((p) => p.decks.map((d) => ({ p, d })))
    .filter(({ d }) => !status || d.status === status);
  const shown = rows.slice(0, 30);
  const facts: SourceFact[] = [fact(`${ref}.total.tests`, "Tests listed", rows.length)];
  const data = shown.map(({ p, d }, i) => {
    const k = `${ref}.t${i + 1}`;
    facts.push(fact(`${k}.swipers`, `${p.name} ${d.label}: swipers`, d.swipers), fact(`${k}.waitlist`, `${p.name} ${d.label}: waitlist`, d.waitlist));
    if (d.chance !== undefined) facts.push(fact(`${k}.chance`, `${p.name} ${d.label}: chance the leader is best`, Math.round(d.chance * 100), `${Math.round(d.chance * 100)}%`));
    return { id: d.id, product: p.name, productId: p.id, variable: d.label, status: d.status, statusLabel: d.statusLabel, versions: d.versions, factKey: k };
  });
  const card: TestTableCard = {
    kind: "testTable",
    rows: shown.map(({ p, d }) => ({ id: d.id, product: p.name, variable: d.label, status: d.statusLabel, tone: d.tone, swipers: int(d.swipers), waitlist: int(d.waitlist), href: testHref(d.id) })),
    more: rows.length > shown.length ? `${rows.length - shown.length} more not shown` : null,
  };
  return { summary: "Listed your tests", call: call("list_tests", { product: product?.name, status: status ?? undefined }), result: { tests: data }, facts, card };
}

export async function getPlanUsageTool(_args: Record<string, unknown>, actor: Actor, ref: string): Promise<AccountOutput> {
  const overview = await getOverview(actor.ownerId);
  const used = overview.products.filter((p) => (p.role ?? "owner") === "owner").reduce((n, p) => n + p.deckCount, 0);
  const left = decksLeft(used);
  const facts = [
    fact(`${ref}.used`, "Tests used", used),
    fact(`${ref}.left`, "Tests left", left),
    fact(`${ref}.allowance`, "Plan allowance", CURRENT_PLAN.deckAllowance),
  ];
  const card: KpiRowCard = { kind: "kpiRow", items: [{ label: "Used", value: int(used) }, { label: "Left", value: int(left) }, { label: CURRENT_PLAN.name, value: int(CURRENT_PLAN.deckAllowance), hint: "plan" }] };
  return { summary: "Checked your plan", call: call("get_plan_usage"), result: { plan: CURRENT_PLAN.name, note: "No limit is enforced yet." }, facts, card };
}

export async function getCurrentPageTool(_args: Record<string, unknown>, actor: Actor): Promise<AccountOutput> {
  const page = await resolvePage(actor);
  const card: PageLinkCard | undefined = page.known ? { kind: "pageLink", title: page.testLabel ?? page.productName ?? page.page, description: page.tab ? `${page.page}, ${page.tab} tab` : page.page, href: page.pathname } : undefined;
  return { summary: "Checked the page you are on", call: call("get_current_page"), result: page, facts: [], card };
}

export async function getCurrentTimeTool(args: Record<string, unknown>, actor: Actor, ref: string): Promise<AccountOutput> {
  const now = nowOf(actor);
  let zone = actor.timeZone;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
  } catch {
    zone = "UTC";
  }
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: zone, day: "numeric", month: "short", year: "numeric" }).format(now);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" }).format(now);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "long" }).format(now);
  const facts = [fact(`${ref}.date`, "Local date", now.getTime(), date), fact(`${ref}.time`, "Local time", now.getTime(), time)];
  const result: Record<string, unknown> = { serverTimeUtc: now.toISOString(), timeZone: zone, weekday, localDate: date, localTime: time };
  if (args.test) {
    const overview = await getOverview(actor.ownerId);
    const { test, product } = findTest(overview, args.test, args.product);
    const created = objectIdTime(test.id);
    if (created !== null) {
      const days = Math.max(0, Math.floor((now.getTime() - created) / 86_400_000));
      facts.push(fact(`${ref}.days_since_created`, `Days since ${product.name} ${test.label} was created`, days));
      result.testCreatedDaysAgo = "see fact days_since_created";
    }
  }
  return { summary: "Checked the time", call: call("get_current_time", { test: args.test as string | undefined }), result, facts };
}

export async function getProfileTool(_args: Record<string, unknown>, actor: Actor, ref: string): Promise<AccountOutput> {
  const [{ connectDb }, { User }] = await Promise.all([import("@/shared/lib/db"), import("@/models")]);
  await connectDb();
  const user = (await User.findById(actor.ownerId).select("name roles role state").lean()) as { name?: string; roles?: string[]; role?: string; state?: string } | null;
  const overview = await getOverview(actor.ownerId);
  const owned = overview.products.filter((p) => (p.role ?? "owner") === "owner").reduce((n, p) => n + p.deckCount, 0);
  const roles = user?.roles?.length ? user.roles : ["swiper"];
  const facts = [fact(`${ref}.tests_used`, "Tests used", owned), fact(`${ref}.tests_left`, "Tests left", decksLeft(owned))];
  return {
    summary: "Checked your profile",
    call: call("get_profile"),
    result: {
      name: user?.name ?? null,
      roles,
      isFounder: roles.includes("founder") || overview.products.length > 0,
      isSwiper: roles.includes("swiper"),
      role: user?.role ?? null,
      state: user?.state ?? null,
      plan: CURRENT_PLAN.name,
      theme: actor.theme ?? null,
    },
    facts,
  };
}

export async function listPagesTool(): Promise<AccountOutput> {
  return {
    summary: "Listed the app's pages",
    call: call("list_pages"),
    result: { pages: APP_PAGES.map((p) => ({ id: p.id, title: p.title, path: p.pattern, about: p.about })), testTabs: TEST_TABS.map((t) => ({ id: t.id, label: t.label })) },
    facts: [],
  };
}

export async function computeTool(args: Record<string, unknown>, _actor: Actor, ref: string): Promise<AccountOutput> {
  const out = runCompute(args as unknown as ComputeArgs, ref);
  let card: ComparisonCard | undefined;
  if ((args as unknown as ComputeArgs).op === "compare_rates") {
    const a = (args as unknown as ComputeArgs).a!;
    const b = (args as unknown as ComputeArgs).b!;
    const ra = a.count / a.total;
    const rb = b.count / b.total;
    const max = Math.max(ra, rb) || 1;
    card = {
      kind: "comparison",
      title: "Side by side",
      rows: [
        { label: a.label?.slice(0, 30) || "A", valueText: out.facts[0].display, countText: `${int(a.count)} of ${int(a.total)}`, fraction: ra / max, winner: ra > rb },
        { label: b.label?.slice(0, 30) || "B", valueText: out.facts[1].display, countText: `${int(b.count)} of ${int(b.total)}`, fraction: rb / max, winner: rb > ra },
      ],
      footnote: "Raw rates. Only a decided Flagsmith test is a Result.",
    };
  }
  return { summary: out.summary, call: call("compute", { op: (args as { op?: string }).op }), result: out.result, facts: out.facts, card };
}

export { COMPUTE_OPS };
