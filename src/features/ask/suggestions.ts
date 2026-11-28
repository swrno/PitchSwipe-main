import type { AskToolCtx } from "./types";

/**
 * Suggested questions above the input (spec 05 section 6.7). "Why did X lose?" names the card that
 * joined least on the current deck; the price question appears only when the product has a price test.
 */
export function suggestedQuestions(ctx: AskToolCtx): string[] {
  const current = ctx.decks[ctx.currentDeckId];
  const rows = current.payload.leaderboard.everyone.filter((r) => (r.swipers ?? 0) > 0 && r.claimRate !== null);
  const loser = rows.length >= 2 ? rows[rows.length - 1] : null;
  const hasPrice = Object.values(ctx.decks).some((d) => d.payload.priceCurve);
  const list = ["What should I test next?"];
  if (loser) list.push(`Why did ${loser.key} lose?`);
  list.push("Do target users disagree with everyone else?");
  if (hasPrice) list.push("Which price earns most?");
  list.push("Which state should I test price in next?");
  return list;
}
