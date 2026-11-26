/** JSON shapes the founder screens consume. Client-safe (no server imports). */
import type { TestVariable } from "@/lib/lists";
import { TEST_VARIABLE_LABELS } from "@/lib/lists";
import type { DeckStatus } from "@/types";
import type { Accent, ProductInput } from "./product";
import type { StatusTone } from "./status";

export interface ProductRecord extends ProductInput {
  id: string;
  ownerId: string;
  deckIds: string[];
}

export interface DeckListItem {
  id: string;
  productId: string;
  variable: TestVariable;
  /** "Headline", "Launch reward", ... as on the My decks screen. */
  label: string;
  versions: number;
  status: DeckStatus;
  statusLabel: string;
  tone: StatusTone;
  chance?: number;
  swipers: number;
  waitlist: number;
}

export interface ProductListItem {
  id: string;
  name: string;
  icon: string;
  category: string;
  accent: Accent;
  deckCount: number;
  waitlist: number;
  decks: DeckListItem[];
}

/**
 * The demo founder's deck allowance, shown as "7 of 10 decks left" (web 06). Billing is Pitch only and the
 * spec states no free-plan allowance counter, so real mode has none (`DecksOverview.allowance` is undefined).
 */
export interface DeckAllowance {
  left: number;
  total: number;
}

export interface DecksOverview {
  demo: boolean;
  /** Demo mode only. Never set for real founders: there is no real quota to compute it from. */
  allowance?: DeckAllowance;
  products: ProductListItem[];
}

/** My decks calls the reward test "Launch reward"; the rest use the test-type label. */
export function deckLabel(variable: TestVariable): string {
  return variable === "reward" ? "Launch reward" : TEST_VARIABLE_LABELS[variable];
}
