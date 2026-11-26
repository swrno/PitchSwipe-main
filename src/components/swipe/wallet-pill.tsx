"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Wallet as WalletIcon } from "lucide-react";
import { AnimatedAmount } from "@/components/ui/animated-amount";
import { fetchWallet, type Fetcher } from "@/lib/claims/client";
import type { WalletView } from "@/lib/claims/rules";
import { getSwiperGuid } from "@/lib/swipe/client";
import { cn, formatRs } from "@/lib/utils";

/**
 * The swiper's own wallet from /api/claims/wallet (the real wallet in real mode, the in-memory demo wallet
 * in demo mode). Reloads whenever `refreshKey` changes (a card was answered, so the wallet may have been
 * credited). Returns null until a read lands, and keeps null if it fails: there is no fallback number.
 */
export function useWallet(fetcher: Fetcher, refreshKey: unknown): WalletView | null {
  const [wallet, setWallet] = React.useState<WalletView | null>(null);
  React.useEffect(() => {
    let live = true;
    fetchWallet(fetcher, getSwiperGuid())
      .then(
        (w) =>
          live &&
          // Keep the same object when nothing changed, so a re-render never triggers another read.
          setWallet((prev) => (prev && JSON.stringify(prev) === JSON.stringify(w) ? prev : w)),
      )
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [fetcher, refreshKey]);
  return wallet;
}

/** An answer that earned money: drives the "+Rs 0.25" that rises out of the pill. */
export interface WalletBump {
  /** Changes with every credited answer, so the same amount twice still plays twice. */
  id: number;
  earnedRs: number;
}

/**
 * The "wallet icon + balance" pill in the top right of the phone screens (designs phone 33, 34). The balance
 * counts up when it changes; a credited answer (`bump`) also sends its amount up out of the pill. Both use
 * the server's numbers: nothing is shown that the wallet did not return.
 */
export function WalletPill({
  balanceRs,
  accentColor,
  className,
  bump,
}: {
  balanceRs: number | null;
  accentColor?: string;
  className?: string;
  bump?: WalletBump | null;
}) {
  const reduce = useReducedMotion();
  if (balanceRs === null) return <span aria-hidden className={cn("h-10 w-28 rounded-full bg-muted/60", className)} />;
  return (
    <span className={cn("relative flex shrink-0", className)}>
      <motion.span
        key={bump?.id ?? 0}
        initial={bump && !reduce ? { scale: 1 } : false}
        animate={bump && !reduce ? { scale: [1, 1.08, 1] } : undefined}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
        className="flex items-center gap-2 whitespace-nowrap rounded-full border border-border bg-muted px-4 py-2 text-sm font-bold tnum"
      >
        <WalletIcon aria-hidden className="size-4" style={accentColor ? { color: accentColor } : undefined} />
        <AnimatedAmount value={balanceRs} />
      </motion.span>
      <AnimatePresence>
        {bump && bump.earnedRs > 0 && !reduce ? (
          <motion.span
            key={bump.id}
            aria-hidden
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: [0, 1, 1, 0], x: [10, 0, 0, 6] }}
            transition={{ duration: 1.4, times: [0, 0.2, 0.75, 1], ease: "easeOut" }}
            className="tnum pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-extrabold text-white"
            style={{ backgroundColor: accentColor ?? "var(--accent)" }}
          >
            +{formatRs(bump.earnedRs)}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
