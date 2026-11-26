/**
 * Site service: connect, status view, ping handling, before/after view. Server only, but every
 * outside thing is injected (ports), so it is unit tested without a database.
 *
 * Flag logic is NOT here: shipping and undo stay in src/lib/assistant (WP8). This module only
 * reads the ship record to show the before/after view.
 */
import type { ShipRecord } from "@/lib/assistant/types";

import { corsHeaders, normalizeDomain, originMatches } from "./domain";
import type { RateLimiter } from "./ratelimit";
import { buildSnippet, markupExample, PLACEHOLDER_KEY, isPlaceholderKey } from "./snippet";
import { agoLabel, applyPing, connectionState, MAX_PING_BYTES, missingFlags, parsePing } from "./status";
import type { SitesStore } from "./store";
import type { SiteRecord, SiteRow, SiteView, WebsiteShippedData } from "./types";

export { agoLabel };

export interface DeckInfo {
  id: string;
  flagName: string;
  /** TestVariable: headline, description, reward, price, productUI, logo, language. */
  variable: string;
  /** DeckStatus: draft, live, decided, shipped, closed. */
  status: string;
  /** The deck's current (control) text, when the variable is text. */
  text?: string;
}

export interface DeckContext {
  deckId: string;
  productId: string;
  productName: string;
  /** "headline", "price", ... */
  noun: string;
  flagName: string;
  controlKey: string;
  cards: { key: string; text: string }[];
  shared: { description?: string; reward?: string; price?: string };
}

export interface Catalog {
  getProduct(ownerId: string, productId: string): Promise<{ id: string; name: string } | null>;
  listProductDecks(ownerId: string, productId: string): Promise<DeckInfo[]>;
  getDeckContext(ownerId: string, deckId: string): Promise<DeckContext | null>;
}

export interface SiteDeps {
  sites: SitesStore;
  catalog: Catalog;
  getShip(deckId: string): Promise<ShipRecord | null>;
  demo: boolean;
  /** Public client key, normally process.env.NEXT_PUBLIC_FLAGSMITH_ENV_KEY. */
  envKey?: string;
  now?: () => Date;
}

export type Outcome<T> = { ok: true; value: T } | { ok: false; status: number; error: string };
const fail = (status: number, error: string): { ok: false; status: number; error: string } => ({ ok: false, status, error });

export const DEMO_SITE_ID = "site-voice-khata";
export const DEMO_PRODUCT_ID = "voice-khata";
export const DEMO_DOMAIN = "voice-khata.vercel.app";
/** What the demo site shows for decks whose cards carry no text of their own (design F2b). */
const DEMO_SITE_TEXT: Record<string, string> = { price: "Rs 299 / mo", reward: "Get 3 months free at launch" };

const TEXT_VARIABLES = ["headline", "description", "reward", "price"] as const;
const LABELS: Record<string, string> = { headline: "Headline", description: "Description", reward: "Launch reward", price: "Price" };
const MARKUP_TAG: Record<string, "h1" | "p" | "span"> = { headline: "h1", description: "p", reward: "span", price: "span" };
const nowOf = (d: { now?: () => Date }) => (d.now ?? (() => new Date()))();

function textDecks(decks: DeckInfo[]): DeckInfo[] {
  return decks.filter((d) => (TEXT_VARIABLES as readonly string[]).includes(d.variable) && d.status !== "closed");
}

/** Demo mode: Voice Khata starts out connected with 3 elements, like designs F2b. */
async function ensureDemoSite(deps: SiteDeps, ownerId: string, productId: string): Promise<SiteRecord | null> {
  const existing = await deps.sites.getByProduct(productId);
  if (existing || !deps.demo || productId !== DEMO_PRODUCT_ID) return existing;
  const decks = textDecks(await deps.catalog.listProductDecks(ownerId, productId)).filter((d) => ["headline", "price", "reward"].includes(d.variable));
  return deps.sites.save({
    id: DEMO_SITE_ID,
    productId,
    domain: DEMO_DOMAIN,
    lastSeenAt: new Date(nowOf(deps).getTime() - 2 * 60_000).toISOString(),
    elements: decks.map((d) => ({ flagName: d.flagName, currentValue: d.text || DEMO_SITE_TEXT[d.variable] || "" })),
  });
}

/** POST /api/sites: connect (or change) the website of a product the caller owns. */
export async function connectSite(
  deps: SiteDeps,
  input: { ownerId: string; productId: unknown; domain: unknown },
): Promise<Outcome<SiteRecord>> {
  if (typeof input.productId !== "string" || !input.productId) return fail(400, "productId is required.");
  const domain = normalizeDomain(input.domain);
  if (!domain) return fail(400, "Enter your website address, for example voice-khata.vercel.app.");
  const product = await deps.catalog.getProduct(input.ownerId, input.productId);
  if (!product) return fail(404, "Product not found.");
  const existing = await deps.sites.getByProduct(product.id);
  if (existing && existing.domain === domain) return { ok: true, value: existing };
  // A new address starts clean: nothing seen yet.
  const saved = await deps.sites.save({ id: existing?.id, productId: product.id, domain, lastSeenAt: null, elements: [] });
  return { ok: true, value: saved };
}

export async function getSiteView(
  deps: SiteDeps,
  input: { ownerId: string; productId: string; baseUrl: string },
): Promise<Outcome<SiteView>> {
  const product = await deps.catalog.getProduct(input.ownerId, input.productId);
  if (!product) return fail(404, "Product not found.");
  const now = nowOf(deps);
  let site = await ensureDemoSite(deps, input.ownerId, product.id);
  if (site && deps.demo && site.id === DEMO_SITE_ID) {
    // Keep the demo reading "seen 2 min ago" unless a real ping is fresher.
    const floor = now.getTime() - 2 * 60_000;
    if (!site.lastSeenAt || Date.parse(site.lastSeenAt) < floor) site = { ...site, lastSeenAt: new Date(floor).toISOString() };
  }
  const decks = textDecks(await deps.catalog.listProductDecks(input.ownerId, product.id));
  const seen = new Map((site?.elements ?? []).map((e) => [e.flagName, e.currentValue]));
  const rows: SiteRow[] = decks.map((d) => {
    const showing = seen.has(d.flagName) ? (seen.get(d.flagName) ?? "") : null;
    const [badge, tone] =
      d.status === "shipped"
        ? (["Won, already live", "green"] as const)
        : d.status === "decided"
          ? (["Won, not shipped", "amber"] as const)
          : d.status === "live"
            ? (["Testing now", "amber"] as const)
            : (["Not live yet", "grey"] as const);
    return { label: LABELS[d.variable] ?? d.variable, flagName: d.flagName, showing, badge, tone, seen: showing !== null };
  });

  const envKey = isPlaceholderKey(deps.envKey) ? PLACEHOLDER_KEY : (deps.envKey as string);
  const state = connectionState(site, now);
  const sample = decks.slice(0, 2).map((d) => ({ flagName: d.flagName, text: d.text ?? LABELS[d.variable] ?? d.variable, tag: MARKUP_TAG[d.variable] }));
  return {
    ok: true,
    value: {
      productName: product.name,
      site: site ? { id: site.id, domain: site.domain } : null,
      state,
      lastSeenAt: site?.lastSeenAt ?? null,
      elementsFound: site?.elements.length ?? 0,
      missingFlags: site && state !== "waiting" ? missingFlags(site, decks.map((d) => d.flagName)) : [],
      rows,
      snippet: site ? buildSnippet({ envKey, siteId: site.id, baseUrl: input.baseUrl }) : null,
      markup: sample.length ? markupExample(sample) : null,
      keyConfigured: !isPlaceholderKey(deps.envKey),
      demo: deps.demo,
    },
  };
}

/* ------------------------------ ping (public) ------------------------------ */

export interface PingLimiters {
  perIp: RateLimiter;
  perSite: RateLimiter;
}

export interface PingResult {
  status: number;
  headers: Record<string, string>;
}

const SITE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** OPTIONS: answers only for the registered origin. */
export async function handlePreflight(deps: SiteDeps, input: { siteId: string | null; origin: string | null }): Promise<PingResult> {
  if (!input.siteId || !SITE_ID_RE.test(input.siteId)) return { status: 404, headers: {} };
  const site = await deps.sites.getById(input.siteId);
  if (!site || !originMatches(input.origin, site.domain)) return { status: 403, headers: {} };
  return { status: 204, headers: corsHeaders(input.origin, site.domain) };
}

/**
 * POST /api/sites/ping?s=<siteId>. Public, so: rate limited, size limited, and the browser's
 * Origin must be the registered domain (CORS only opens for that origin). Stores last-seen and
 * the detected elements. Origin can be forged by a non-browser client; the worst it can do is
 * overwrite what the site "shows" in the connect screen, never a flag.
 */
export async function handlePing(
  deps: SiteDeps,
  limiters: PingLimiters,
  input: { siteId: string | null; origin: string | null; ip: string; body: string },
): Promise<PingResult> {
  if (!limiters.perIp.take(input.ip)) return { status: 429, headers: { "retry-after": "60" } };
  if (!input.siteId || !SITE_ID_RE.test(input.siteId)) return { status: 404, headers: {} };
  if (!limiters.perSite.take(input.siteId)) return { status: 429, headers: { "retry-after": "60" } };
  if (input.body.length > MAX_PING_BYTES) return { status: 413, headers: {} };
  const site = await deps.sites.getById(input.siteId);
  if (!site) return { status: 404, headers: {} };
  if (!originMatches(input.origin, site.domain)) return { status: 403, headers: {} };
  const headers = corsHeaders(input.origin, site.domain);
  const ping = parsePing(input.body);
  if (!ping) return { status: 400, headers };
  await deps.sites.save(applyPing(site, ping, nowOf(deps)));
  return { status: 204, headers };
}

/* --------------------------- before / after (F9c) --------------------------- */

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export async function getWebsiteShipped(deps: SiteDeps, input: { ownerId: string; deckId: string }): Promise<Outcome<WebsiteShippedData>> {
  const deck = await deps.catalog.getDeckContext(input.ownerId, input.deckId);
  if (!deck) return fail(404, "Deck not found.");
  const ship = await deps.getShip(deck.deckId);
  if (!ship || ship.ownerId !== input.ownerId) return fail(404, "Nothing is shipped for this deck yet.");
  const before = deck.cards.find((c) => c.key === deck.controlKey);
  const after = deck.cards.find((c) => c.key === ship.winnerKey);
  if (!before || !after) return fail(404, "Could not find the versions of this deck.");

  let site = await deps.sites.getByProduct(deck.productId);
  if (!site && deps.demo) site = await ensureDemoSite(deps, input.ownerId, deck.productId);
  const reported = site?.elements.find((e) => e.flagName === deck.flagName);
  let proof: WebsiteShippedData["proof"] = null;
  if (deps.demo && site && !ship.undoneAt) {
    // Demo ships are simulated and no page pings, so show the value the snippet would have reported.
    proof = { value: after.text, seenAt: new Date(Date.parse(ship.approvedAt) + 7_000).toISOString(), matchesWinner: true };
  } else if (site?.lastSeenAt && reported) {
    proof = { value: reported.currentValue, seenAt: site.lastSeenAt, matchesWinner: reported.currentValue.trim() === after.text.trim() };
  }
  const ctx = deck.shared;
  return {
    ok: true,
    value: {
      deckId: deck.deckId,
      productName: deck.productName,
      noun: cap(deck.noun),
      flagName: deck.flagName,
      beforeKey: before.key,
      beforeText: before.text,
      afterKey: after.key,
      afterText: after.text,
      shippedAt: ship.approvedAt,
      live: !ship.undoneAt,
      undone: Boolean(ship.undoneAt),
      domain: site?.domain ?? null,
      proof,
      context: {
        description: ctx.description ?? "",
        reward: ctx.reward ?? "",
        price: ctx.price ?? "",
      },
      connectHref: `/products/${encodeURIComponent(deck.productId)}/connect`,
    },
  };
}
