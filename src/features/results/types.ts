/**
 * Client-safe shapes for the founder Results / Who swiped screens (WP7).
 * The payload carries aggregates only: never names, raw IPs, or emails other than
 * explicit waitlist claimants.
 */
import type { DemandCurveData } from "@/features/demand-curve";
import type { State, TestVariable } from "@/shared/lib/lists";
import type { DeckStatus, PriceMode } from "@/types";

export const LEADER_FILTERS = ["everyone", "target", "link"] as const;
export type LeaderFilter = (typeof LEADER_FILTERS)[number];

export const LEADER_FILTER_LABELS: Record<LeaderFilter, string> = {
  everyone: "Everyone",
  target: "Target users",
  link: "Your link only",
};

export const WHO_TABS = ["location", "target", "source", "interests"] as const;
export type WhoTab = (typeof WHO_TABS)[number];

export const WHO_TAB_LABELS: Record<WhoTab, string> = {
  location: "Location",
  target: "Target users",
  source: "Source",
  interests: "Interests",
};

export interface LeaderRow {
  rank: number;
  key: string;
  /** "Headline B", "Rs 199 / mo". */
  label: string;
  /** What the card says ("Stop chasing payments. Get paid on time."). */
  valueText: string;
  /** Null when the group is under 10 swipers (segment filters only). */
  swipers: number | null;
  saidYes: number | null;
  joined: number | null;
  /** Fraction 0 to 1, null when suppressed. */
  claimRate: number | null;
  /** Flagsmith chance this card is best, 0 to 1. Only on the Everyone filter. */
  chanceBest: number | null;
  suppressed: boolean;
}

export type VerdictKind = "decided" | "leading" | "too_close" | "collecting" | "none";

export interface VerdictView {
  kind: VerdictKind;
  /** Phone headline, e.g. "Headline B is in the lead." */
  headline: string;
  /** Pill text, e.g. "Leading, not decided yet". */
  pill: string;
  leaderKey: string | null;
  leaderLabel: string | null;
  /** Flagsmith chance for the leader, 0 to 1. */
  chance: number | null;
}

export interface SegmentRowView {
  key: string;
  label: string;
  swipers: number;
  saidYes: number;
  joined: number;
  /** Fraction 0 to 1. */
  joinRate: number;
  best: boolean;
}

export interface SegmentView {
  rows: SegmentRowView[];
  /** Groups under 10 swipers rolled together. Null when nothing was hidden. */
  other: { swipers: number; saidYes: number; joined: number; groupCount: number } | null;
  /** True when `other` is big enough (10+) to show its numbers. */
  otherVisible: boolean;
  overall: { swipers: number; saidYes: number; joined: number; rate: number };
  shown: { swipers: number; saidYes: number; joined: number };
  /** Number of groups counted for the Lead line (shown groups + 1 if some were rolled into Other). */
  groupCount: number;
  /** Bars are drawn against this fraction (0.35 by default). */
  axisMax: number;
  /** True for interests: one person can follow several, so groups add up to more than the total. */
  overlapping: boolean;
}

export interface InsightView {
  title: string;
  body: string;
  /** Always a Lead: "Lead: 1 of 6 state groups, 41 swipers. Confirm with a test in Gujarat." */
  lead: string;
  /** Source tab only: feed and link disagree. */
  warning?: boolean;
}

export interface LocationTab extends SegmentView {
  insight: InsightView | null;
  /** Tile-map colouring: state to join rate, only for shown groups. */
  tiles: { state: State; joinRate: number; best: boolean }[];
  hiddenNote: string | null;
}

export interface TargetTab {
  roles: string[];
  target: SegmentRowView | null;
  everyone: SegmentRowView | null;
  /** Both groups are 10+ swipers. */
  enough: boolean;
  total: { swipers: number; saidYes: number; joined: number; text: string };
  insight: InsightView | null;
}

export interface SourceCardRow {
  key: string;
  label: string;
  feed: { swipers: number; saidYes: number; joined: number; rate: number } | null;
  link: { swipers: number; saidYes: number; joined: number; rate: number } | null;
  feedBest: boolean;
  linkBest: boolean;
}

export interface SourceTab extends SegmentView {
  cards: SourceCardRow[];
  totalText: string;
  insight: InsightView | null;
}

export interface InterestsTab extends SegmentView {
  insight: InsightView | null;
  tiles: { value: string; text: string }[];
  totalText: string;
}

export interface SaidYesVsActed {
  swipers: number;
  saidYes: number;
  saidYesPct: number;
  joined: number;
  joinedPct: number;
  /** Percentage points between "said yes" and "joined". */
  gapPoints: number;
  /** "34 points said yes but did not act." */
  headline: string;
  note: string;
}

export interface WhoSwipedView {
  validSwipers: number;
  hasData: boolean;
  location: LocationTab;
  target: TargetTab;
  source: SourceTab;
  interests: InterestsTab;
  saidYesVsActed: SaidYesVsActed;
}

export interface ClaimantView {
  email: string;
  cardLabel: string;
  /** "Today", "Yesterday" or a short date. */
  when: string;
}

export interface WaitlistView {
  count: number;
  reward: string | null;
  /** First few only. The full list is the CSV. */
  preview: ClaimantView[];
  moreCount: number;
  /** "all 3 headlines" style text for the phone card. */
  acrossText: string;
}

export interface TotalsView {
  swipers: number;
  saidYes: number;
  saidYesPct: number;
  joined: number;
  joinedPct: number;
  feed: number;
  link: number;
  targetSharePct: number;
}

export interface DeckMeta {
  id: string;
  productId: string;
  productName: string;
  /** "Headline test". */
  label: string;
  variable: TestVariable;
  /** "headline", "price", "product screens"... for "Which X is winning". */
  noun: string;
  flagName: string;
  status: DeckStatus;
  priceMode?: PriceMode;
  /** Founder-facing status label from My decks (WP5), e.g. "Won". */
  statusLabel: string;
  /**
   * Real mode only: set when the deck is NOT running on Flagsmith (local split, no winner call). The text is the
   * stored publish failure reason, or "" when Flagsmith was not configured at publish.
   */
  localSplitReason?: string;
}

export interface AssistantNote {
  refreshedAt: string | null;
  minutesAgo: number | null;
}

export interface ResultsPayload {
  deck: DeckMeta;
  verdict: VerdictView;
  totals: TotalsView;
  leaderboard: Record<LeaderFilter, LeaderRow[]>;
  waitlist: WaitlistView;
  whoSwiped: WhoSwipedView;
  /** Present for "find the best price" decks. */
  priceCurve: DemandCurveData | null;
  assistant: AssistantNote;
  /** False when Flagsmith could not be read (not configured or error). */
  flagsmithAvailable: boolean;
  generatedAt: string;
}

export interface SwitcherItem {
  id: string;
  label: string;
  /** "Leading · 91% chance best", "Won · 95% sure". */
  statusText: string;
  current: boolean;
}

export interface SwitcherView {
  productId: string;
  productName: string;
  productIcon: string;
  accent: "green" | "blue" | "purple";
  currentId: string;
  currentLabel: string;
  items: SwitcherItem[];
}

