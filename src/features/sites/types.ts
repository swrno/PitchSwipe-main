/** Shared types for "ship to the founder's website" (WP9, spec 02 5.15). Type-only: safe for client code. */

export const SITE_STATES = ["waiting", "connected", "element_not_found"] as const;
export type SiteState = (typeof SITE_STATES)[number];

/** One marked element the snippet reported: the flag it is wired to and the text it shows now. */
export interface SiteElement {
  flagName: string;
  currentValue: string;
}

/** A site as stored (matches the `sites` collection: productId, domain, lastSeenAt, elements[]). */
export interface SiteRecord {
  id: string;
  productId: string;
  /** Hostname only, lower case, e.g. "voice-khata.vercel.app". */
  domain: string;
  lastSeenAt: string | null;
  elements: SiteElement[];
}

/** What the snippet sends to POST /api/sites/ping, after validation. */
export interface PingPayload {
  elements: SiteElement[];
}

export interface SiteRow {
  label: string;
  flagName: string;
  /** What the snippet last reported, or null when not seen. */
  showing: string | null;
  badge: "Testing now" | "Won, already live" | "Won, not shipped" | "Not live yet";
  tone: "amber" | "green" | "grey";
  seen: boolean;
}

/** Public config behind the snippet, shared by every framework variant. */
export interface SiteSetup {
  envKey: string;
  siteId: string;
  baseUrl: string;
  flagsUrl?: string;
  pollSeconds?: number;
  /** One per text test: the flag name and the current text (the fallback). */
  flags: { flagName: string; text: string; tag?: "h1" | "span" | "p" }[];
}

/** What GET /api/sites returns for the connect screen (F2b). */
export interface SiteView {
  productName: string;
  site: { id: string; domain: string } | null;
  state: SiteState;
  lastSeenAt: string | null;
  elementsFound: number;
  /** Flags of this product's decks that no element on the site uses yet. */
  missingFlags: string[];
  rows: SiteRow[];
  snippet: string | null;
  /** Markup example for the first deck flags. */
  markup: string | null;
  /** Config every framework variant is built from (public values only); null until a site exists. */
  setup: SiteSetup | null;
  /** False when NEXT_PUBLIC_FLAGSMITH_ENV_KEY is unset: the snippet shows a placeholder. */
  keyConfigured: boolean;
}

/** What the before/after screen (F9c, web 22) shows. */
export interface WebsiteShippedData {
  deckId: string;
  productName: string;
  /** "Headline" (singular noun, capitalised) */
  noun: string;
  flagName: string;
  beforeKey: string;
  beforeText: string;
  afterKey: string;
  afterText: string;
  shippedAt: string;
  /** True when the deck was shipped and not undone. */
  live: boolean;
  undone: boolean;
  domain: string | null;
  /** Latest value the snippet reported for this flag, and when. */
  proof: { value: string; seenAt: string; matchesWinner: boolean } | null;
  /** Other copy on the mock page so before/after reads like the site. */
  context: { description: string; reward: string; price: string };
  connectHref: string;
}
