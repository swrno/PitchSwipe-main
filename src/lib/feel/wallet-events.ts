"use client";

import * as React from "react";

/**
 * The swipe page learns the new wallet balance from the server the moment an answer is credited
 * (POST /api/claims/wallet returns it). It announces it here so other parts of the screen (the web
 * sidebar's wallet badge) update at once instead of waiting for their own next read. Same tab only.
 */
const EVENT = "ps:wallet-balance";

export function announceBalance(balanceRs: number): void {
  if (typeof window === "undefined" || !Number.isFinite(balanceRs)) return;
  window.dispatchEvent(new CustomEvent<number>(EVENT, { detail: balanceRs }));
}

/** The last balance announced on this page, or null until one is. */
export function useAnnouncedBalance(): number | null {
  const [balance, setBalance] = React.useState<number | null>(null);
  React.useEffect(() => {
    const on = (e: Event) => setBalance((e as CustomEvent<number>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return balance;
}
