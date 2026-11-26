/**
 * Types mirroring the data model in docs/spec/06 §8.2 (v2).
 * Field names must not be renamed. Mongoose schemas live in src/models.
 * `_id` is a string here (serialised ObjectId).
 */
import type { Industry, Role, State, TestVariable } from "@/lib/lists";

export type ObjectIdString = string;

export const ACCOUNT_ROLES = ["swiper", "founder"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export const DECK_STATUSES = ["draft", "live", "decided", "shipped", "closed"] as const;
export type DeckStatus = (typeof DECK_STATUSES)[number];

export const PRICE_MODES = ["level", "framing"] as const;
export type PriceMode = (typeof PRICE_MODES)[number];

export const RESPONSE_SOURCES = ["feed", "link"] as const;
export type ResponseSource = (typeof RESPONSE_SOURCES)[number];

export const ANSWERS = ["positive", "negative"] as const;
export type Answer = (typeof ANSWERS)[number];

export const AUDIENCE_WHO = ["everyone", "targetOnly"] as const;
export type AudienceWho = (typeof AUDIENCE_WHO)[number];

export const ASSISTANT_EVENT_TYPES = ["checked", "decided", "approved", "shipped", "undone"] as const;
export type AssistantEventType = (typeof ASSISTANT_EVENT_TYPES)[number];

export interface User {
  _id: ObjectIdString;
  /** Firebase Authentication uid. Unique. */
  firebaseUid: string;
  name: string;
  /** Account email (spec §8.2 lists `email` twice; modelled as `email` + `emailVerified`). */
  email: string;
  /** Mirror of Firebase's emailVerified. Firebase is the source of truth. */
  emailVerified: boolean;
  roles: AccountRole[];
  /** One value from the standard role list, self-declared. */
  role?: Role;
  /** Self-declared; checked against IP. */
  state?: State;
  /** Values from the standard industry list. */
  interests: Industry[];
  qualityScore: number; // 0 to 100
  /** True when qualityScore >= 70. */
  counting: boolean;
  checkReasons: string[];
  createdAt: Date;
}

export interface Product {
  _id: ObjectIdString;
  ownerId: ObjectIdString;
  name: string;
  icon: string;
  /** Category line text, e.g. "Voice ledger · Retail". */
  category: string;
  industry: Industry;
  showOwnerName: boolean;
  /** Roles shown as "Made for" on cards. */
  targetUsers: Role[];
  audience: {
    who: AudienceWho;
    states: State[];
    interests: Industry[];
  };
  deckIds: ObjectIdString[];
  insights?: {
    text: string;
    sourceDeckIds: ObjectIdString[];
    generatedAt: Date;
  };
}

export interface Deck {
  _id: ObjectIdString;
  ownerId: ObjectIdString;
  productId: ObjectIdString;
  slug: string;
  variable: TestVariable;
  /** Price decks only. */
  priceMode?: PriceMode;
  /** All locked fields, identical on every card. */
  shared: Record<string, unknown>;
  question: string;
  positiveLabel: string;
  negativeLabel: string;
  flagName: string;
  experimentId?: string;
  /**
   * Flagsmith feature id of the deck flag (set at publish when the experiment runs on Flagsmith). Without an
   * experimentId it is a half-made flag whose cleanup failed at publish; archiving the deck archives it.
   */
  featureId?: number;
  /** Flagsmith multivariate option id per NON-control variant key (the ship call's rollout_variant). */
  optionIds?: Record<string, number>;
  /** Flagsmith metric id of reward_claim (`metric_id` in the results payload). */
  rewardMetricId?: string;
  /** Why publishing to Flagsmith failed; the deck then runs a local split and never gets a winner call. */
  flagsmithError?: string;
  /**
   * Set while a publish is talking to Flagsmith (an atomic claim, so two publishes of one deck cannot both
   * create flags); cleared by the publish's final save. A claim older than 5 minutes counts as abandoned.
   */
  publishingAt?: Date | null;
  status: DeckStatus;
  decidedAt?: Date;
  shippedAt?: Date;
  shippedBy?: ObjectIdString;
  winnerCardId?: ObjectIdString;
  listedInFeed: boolean;
  boost: {
    perSwipe: number;
    budget: number;
    spent: number;
  };
}

export interface Card {
  _id: ObjectIdString;
  deckId: ObjectIdString;
  variantKey: string;
  /** Only the field under test. */
  value: unknown;
}

export interface CommentVoice {
  audioUrl?: string;
  durationSec: number;
  language: string;
  transcript: string;
  english: string;
  founderCanPlay: boolean;
}

export interface Response {
  _id: ObjectIdString;
  deckId: ObjectIdString;
  swiperId: ObjectIdString;
  source: ResponseSource;
  /** The one card Flagsmith assigned. */
  cardId: ObjectIdString;
  /** Role the swiper had at the time of the swipe. */
  role?: Role;
  /** Computed from the swiper's role at swipe time against product.targetUsers. */
  isTargetUser: boolean;
  answer: Answer;
  dwellMs: number;
  /** State estimated from IP. Raw IP is never exposed to the client. */
  region?: State;
  /** Passed the 2 s read-time floor. */
  valid: boolean;
  /** Valid and the swiper's quality score is 70+. Only counted swipes reach Flagsmith and are paid. */
  counted: boolean;
  comment?: string;
  commentVoice?: CommentVoice;
  createdAt: Date;
}

export interface Claim {
  _id: ObjectIdString;
  deckId: ObjectIdString;
  cardId: ObjectIdString;
  email: string;
  createdAt: Date;
}

export interface Site {
  _id: ObjectIdString;
  productId: ObjectIdString;
  domain: string;
  lastSeenAt: Date;
  elements: { flagName: string; currentValue: string }[];
}

export interface AssistantEvent {
  _id: ObjectIdString;
  deckId: ObjectIdString;
  type: AssistantEventType;
  /** Chance each card is best, as a fraction 0 to 1. */
  chanceBest: { cardId: ObjectIdString; chance: number }[];
  swipers: number;
  checksPassed: boolean;
  createdAt: Date;
}

export interface Wallet {
  _id: ObjectIdString;
  userId: ObjectIdString;
  /** Demo earnings in rupees during the hackathon. */
  balance: number;
  entries: {
    deckId: ObjectIdString;
    amount: number;
    swipeCount: number;
    createdAt: Date;
  }[];
}

/** After the hackathon. */
export interface Credits {
  _id: ObjectIdString;
  ownerId: ObjectIdString;
  decksLeft: number;
  purchases: unknown[];
}

/** Flagsmith results as the wrapper returns them (see src/lib/flagsmith). */
export interface FlagsmithCardResult {
  cardId: ObjectIdString;
  variantKey: string;
  identities: number;
  /** Chance this card beats control, 0 to 1. */
  chanceToBeatControl: number;
}

export interface FlagsmithExperimentResults {
  experimentId: string;
  flagName: string;
  cards: FlagsmithCardResult[];
  srmWarning: boolean;
  refreshedAt: Date;
}
