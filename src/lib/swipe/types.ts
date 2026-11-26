/**
 * Swipe feed types (WP3). Decoupled from the founder-side deck types on purpose:
 * this is the shape the swipe pages need, built from Mongo rows or demo fixtures.
 */
import type { Industry, Role, State, TestVariable } from "@/lib/lists";
import type { Answer, AudienceWho, DeckStatus, ResponseSource } from "@/types";

export type SwipeSource = ResponseSource;
export type Accent = "green" | "blue" | "purple";

export interface SwipeProduct {
  name: string;
  /** One or two letters, or a glyph key (see components/swipe/deck-card). */
  icon: string;
  /** "Voice ledger · Retail". */
  category: string;
  industry: Industry;
  accent: Accent;
  showOwnerName: boolean;
  ownerName?: string;
  /** Shown as "Made for". */
  targetUsers: Role[];
  audience: { who: AudienceWho; states: State[]; interests: Industry[] };
}

export interface SwipeLogo {
  name: string;
  src: string;
}

/** Locked fields, identical on every card. */
export interface SwipeShared {
  headline?: string;
  description?: string;
  reward?: string;
  price?: string;
  productUI?: string[];
  logo?: SwipeLogo;
}

/** Card value for the Language test: the whole translated card. */
export interface SwipeLanguageValue {
  language: string;
  headline: string;
  description: string;
  reward: string;
  question: string;
  positiveLabel: string;
  negativeLabel: string;
}

export interface SwipeCardRow {
  id: string;
  variantKey: string;
  /** Only the field under test. */
  value: unknown;
}

export interface SwipeDeck {
  id: string;
  slug: string;
  flagName: string;
  /** Set when the deck runs on Flagsmith. Without it the deck is a local split: no Flagsmith calls at all. */
  experimentId?: string;
  variable: TestVariable;
  status: DeckStatus;
  listedInFeed: boolean;
  question: string;
  positiveLabel: string;
  negativeLabel: string;
  shared: SwipeShared;
  /** Control card first (variantKeys[0]). */
  cards: SwipeCardRow[];
  winnerCardId?: string;
  boost: { perSwipe: number; budget: number; spent: number };
  product: SwipeProduct;
  /** A starter deck from the house account (npm run seed:feed): the feed shows it less often than a founder's deck. */
  starter?: boolean;
}

export interface SwiperProfile {
  /** Stable id used for the Flagsmith identity, one-vote check and storage. */
  key: string;
  guest: boolean;
  /** Demo mode: no Firebase, fixture profile. */
  demo: boolean;
  role?: Role;
  state?: State;
  interests: Industry[];
  /** Quality score 70+. Guests in production are not counting. */
  counting: boolean;
  /** Stored quality score (0-100) for a signed-in swiper who has taken the check; undefined otherwise. */
  qualityScore?: number;
}

export type AssignedBy = "flagsmith" | "local";

/** What the browser receives for one card. Never contains the variant key, ids of other cards or the raw IP. */
export interface CardView {
  deckId: string;
  slug: string;
  cardId: string;
  source: SwipeSource;
  paid: boolean;
  paidRs: number;
  /** Swiper's quality flag, so the UI can say "Not counted yet". */
  counting: boolean;
  product: { name: string; icon: string; category: string; accent: Accent };
  ownerName?: string;
  logo?: SwipeLogo;
  headline: string;
  headlineLines: [string, string | null];
  description: string;
  reward: string;
  price: { amount: string; unit: string | null } | null;
  screens: string[];
  madeFor: Role[];
  question: string;
  positiveLabel: string;
  negativeLabel: string;
  /** Card language label, e.g. "Hindi". */
  language: string;
  /** BCP-47 tag for the lang attribute. */
  lang: string;
}

export interface NextCardResponse {
  card: CardView | null;
  /** Server clock when the card was served (display only; dwell uses the signed value in `token`). */
  servedAt: number;
  /** Signed served-card token (deck, swiper, card, servedAt, source). Required by /api/responses and the claim routes. */
  token?: string;
  reason?: "empty";
}

export interface SubmitInput {
  deckId: string;
  cardId: string;
  answer: Answer;
  /** Signed token from /api/responses/next. Source, served card and servedAt all come from it. */
  token: string;
}

export interface SubmitSuccess {
  ok: true;
  responseId: string;
  valid: boolean;
  counted: boolean;
  paid: boolean;
  /** Demo earnings for this swipe (0 unless paid, valid and counted). The wallet is WP4. */
  earnedRs: number;
  sentToFlagsmith: boolean;
  source: SwipeSource;
  deckId: string;
  cardId: string;
  answer: Answer;
  /** The served token, echoed so the claim, comment and wallet calls can present it. */
  servedToken: string;
}

export type SubmitOutcome =
  | SubmitSuccess
  | { ok: false; ignored: true; reason: "too_fast" }
  | { ok: false; ignored?: false; status: 400 | 404 | 409 | 503; error: string };
