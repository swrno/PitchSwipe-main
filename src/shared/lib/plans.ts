/**
 * The founder's deck plan. Billing is not built yet, so every founder is on the Flagsmith Hackathon plan:
 * 1,000 free decks. Shown as "decks left" in the top bar; no limit is enforced yet.
 */
export const CURRENT_PLAN = { name: "Flagsmith Hackathon", deckAllowance: 1000 } as const;

export function decksLeft(used: number, allowance: number = CURRENT_PLAN.deckAllowance): number {
  return Math.max(0, allowance - Math.max(0, used));
}
