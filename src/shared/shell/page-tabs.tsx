"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActivePath } from "@/shared/lib/nav";
import { cn } from "@/shared/lib/utils";

export interface PageTab {
  label: string;
  href: string;
  /** Active only on exactly this path (the root tab of a page). Otherwise active on the path and below. */
  exact?: boolean;
  /** Extra path prefixes that also mark this tab active. */
  alsoActive?: readonly string[];
}

export function isTabActive(pathname: string, tab: PageTab): boolean {
  if (tab.exact) return pathname === tab.href;
  return isActivePath(pathname, tab.href) || (tab.alsoActive?.some((p) => isActivePath(pathname, p)) ?? false);
}

/** Sub-pages as links; the active one is underlined in the accent. Scrolls sideways on phones. */
export function PageTabs({ tabs, label = "Sections", className }: { tabs: readonly PageTab[]; label?: string; className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className={cn("-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0", className)}>
      <ul className="flex min-w-max gap-1 border-b border-border">
        {tabs.map((tab) => {
          const active = isTabActive(pathname, tab);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  active
                    ? "border-accent font-semibold text-foreground"
                    : "border-transparent font-medium text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
