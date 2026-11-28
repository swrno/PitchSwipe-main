"use client";

import Link from "next/link";
import * as React from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/features/auth/ui/provider";
import { CURRENT_PLAN, decksLeft } from "@/shared/lib/plans";

const fmt = (n: number) => n.toLocaleString("en-IN");

/**
 * One shared, cached deck count per account. The top bar, the sidebar and the Plans page all read it, so a page
 * load makes one /api/decks request instead of three. Cached values show at once; a stale one (older than
 * FRESH_MS) is re-read in the background on mount and on navigation.
 */
const FRESH_MS = 15_000;
interface CountEntry {
  count: number | null;
  at: number;
  inflight: boolean;
  subs: Set<() => void>;
}
const counts = new Map<string, CountEntry>();

/** Call after creating or deleting a deck so every reader re-reads the count. */
export function invalidateDecksUsed(): void {
  counts.forEach((e) => (e.at = 0));
}

/** Decks used by the signed-in founder, or null while unknown / signed out. */
export function useDecksUsed(): number | null {
  const { user, authFetch } = useAuth();
  const pathname = usePathname();
  const [, rerender] = React.useReducer((n: number) => n + 1, 0);
  const uid = user?.uid;

  React.useEffect(() => {
    if (!uid) return;
    let entry = counts.get(uid);
    if (!entry) {
      entry = { count: null, at: 0, inflight: false, subs: new Set() };
      counts.set(uid, entry);
    }
    const e = entry;
    e.subs.add(rerender);
    if (e.count !== null) rerender();
    if (!e.inflight && Date.now() - e.at > FRESH_MS) {
      e.inflight = true;
      authFetch("/api/decks")
        .then((res) => (res.ok ? (res.json() as Promise<{ decks?: unknown[] }>) : null))
        .then((data) => {
          if (data && Array.isArray(data.decks)) {
            e.count = data.decks.length;
            e.at = Date.now();
            e.subs.forEach((notify) => notify());
          }
        })
        .catch(() => undefined)
        .finally(() => {
          e.inflight = false;
        });
    }
    return () => {
      e.subs.delete(rerender);
    };
  }, [uid, authFetch, pathname]);

  return uid ? (counts.get(uid)?.count ?? null) : null;
}

/** Compact "980 of 1,000 decks left" link to the plans page, for the sidebar. Signed in only. */
export function DecksLeftCompact() {
  const used = useDecksUsed();
  if (used === null) return null;
  const left = decksLeft(used);
  return (
    <Link
      href="/settings/plan"
      className="block rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
    >
      <span className="tnum font-semibold text-foreground">{fmt(left)}</span> of {fmt(CURRENT_PLAN.deckAllowance)}{" "}
      {left === 1 ? "deck" : "decks"} left
    </Link>
  );
}

/** "980 decks left" on the founder's current plan, with a meter. Signed in only. */
export function DecksLeftCard() {
  const used = useDecksUsed();
  if (used === null) return null;
  const left = decksLeft(used);
  const allowance = CURRENT_PLAN.deckAllowance;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="tnum text-3xl font-semibold tracking-tight">{fmt(left)}</span>
        <span className="text-muted-foreground">
          {left === 1 ? "deck" : "decks"} left of {fmt(allowance)} on the {CURRENT_PLAN.name} plan
        </span>
      </p>
      <div
        className="mt-3 h-2 rounded-full bg-muted"
        role="progressbar"
        aria-label="Decks left"
        aria-valuenow={left}
        aria-valuemin={0}
        aria-valuemax={allowance}
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((left / allowance) * 100)}%` }} />
      </div>
    </div>
  );
}
