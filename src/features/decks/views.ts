/** JSON shapes the founder screens consume. Client-safe (no server imports). */
import type { TestVariable } from "@/shared/lib/lists";
import { TEST_VARIABLE_LABELS } from "@/shared/lib/lists";
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
  /** "owner" for your own product, "cofounder" for one you were invited to (you can edit its decks, not manage it). */
  role?: "owner" | "cofounder";
  id: string;
  name: string;
  icon: string;
  category: string;
  accent: Accent;
  deckCount: number;
  waitlist: number;
  decks: DeckListItem[];
}

export interface DecksOverview {
  products: ProductListItem[];
}

/** My decks calls the reward test "Launch reward"; the rest use the test-type label. */
export function deckLabel(variable: TestVariable): string {
  return variable === "reward" ? "Launch reward" : TEST_VARIABLE_LABELS[variable];
}
