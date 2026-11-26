/** Price helpers for the "Find the best price" test (spec/02 §5.13). Pure. */

export interface ParsedPrice {
  amount: number;
  /** Everything after the number, normalised, e.g. "/ mo". Used to check "same unit". */
  unit: string;
}

/** Parses "Rs 199 / mo" or "Rs 1,600" into amount and unit. Returns null when there is no number. */
export function parsePrice(label: string): ParsedPrice | null {
  const match = /(\d[\d,]*(?:\.\d+)?)/.exec(label);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(amount)) return null;
  const unit = label
    .slice((match.index ?? 0) + match[0].length)
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s*\/\s*/g, "/")
    .replace(/^per\s+/, "/");
  return { amount, unit };
}

export interface PriceCheck {
  ok: boolean;
  message?: string;
}

/** 2 to 4 prices in the same unit, all different (find the best price). */
export function checkPriceLevels(labels: string[]): PriceCheck {
  const parsed = labels.map(parsePrice);
  if (parsed.some((p) => p === null)) return { ok: false, message: "Every price needs a number, for example Rs 199 / mo." };
  const prices = parsed as ParsedPrice[];
  if (prices.some((p) => p.amount <= 0)) return { ok: false, message: "Prices must be above zero." };
  if (new Set(prices.map((p) => p.unit)).size > 1) {
    return { ok: false, message: "Use the same unit for every price (for example all per month)." };
  }
  if (new Set(prices.map((p) => p.amount)).size !== prices.length) {
    return { ok: false, message: "Each price must be different." };
  }
  return { ok: true };
}
