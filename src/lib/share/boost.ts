/** Boost options. Pitch only: static UI, no payment or billing is built (spec/02, spec/08 13.4). */

export const BOOST_PRICE_PER_SWIPE_RS = 2;
export const BOOST_SWIPER_SHARE_RS = 0.25;
export const BOOST_AMOUNTS_RS = [300, 600, 1200] as const;
export const DEFAULT_BOOST_RS = 600;

export interface BoostOption {
  amountRs: number;
  swipes: number;
  label: string;
  swipesLabel: string;
}

const rs = (n: number) => `Rs ${n.toLocaleString("en-IN")}`;

export const BOOST_OPTIONS: BoostOption[] = BOOST_AMOUNTS_RS.map((amountRs) => {
  const swipes = amountRs / BOOST_PRICE_PER_SWIPE_RS;
  return { amountRs, swipes, label: rs(amountRs), swipesLabel: `${swipes.toLocaleString("en-IN")} swipes` };
});

export const boostButtonLabel = (amountRs: number) => `Boost for ${rs(amountRs)}`;
