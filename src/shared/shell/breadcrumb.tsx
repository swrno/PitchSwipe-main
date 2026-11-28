"use client";

import * as React from "react";

export interface Crumb {
  label: string;
  /** Omit on the last crumb (the current page). */
  href?: string;
}

interface BreadcrumbContextValue {
  crumbs: readonly Crumb[] | null;
  set: (crumbs: readonly Crumb[] | null) => void;
}

const BreadcrumbContext = React.createContext<BreadcrumbContextValue>({ crumbs: null, set: () => undefined });

/** Holds the page-supplied breadcrumb. The top bar renders it; without one it falls back to route-based labels. */
export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [crumbs, set] = React.useState<readonly Crumb[] | null>(null);
  const value = React.useMemo(() => ({ crumbs, set }), [crumbs]);
  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
}

/** The breadcrumb a page registered, or null. Read by the top bar. */
export function useBreadcrumbItems(): readonly Crumb[] | null {
  return React.useContext(BreadcrumbContext).crumbs;
}

/**
 * Register this page's breadcrumb with real names, e.g.
 * `useBreadcrumb([{ label: "Products", href: "/products" }, { label: productName, href }, { label: deckLabel }])`.
 * Pass null while names are still loading to keep the route-based fallback. Cleared when the page unmounts.
 */
export function useBreadcrumb(crumbs: readonly Crumb[] | null): void {
  const { set } = React.useContext(BreadcrumbContext);
  const key = crumbs ? JSON.stringify(crumbs) : "";
  React.useEffect(() => {
    set(key ? (JSON.parse(key) as Crumb[]) : null);
    return () => set(null);
  }, [key, set]);
}
