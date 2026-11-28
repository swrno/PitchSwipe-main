import { Home, Layers, LayoutGrid, Settings, Wallet, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Full override: when set, only this decides whether the item is active. */
  match: (pathname: string) => boolean;
}

export interface Crumb {
  label: string;
  href?: string;
}

export const NEW_DECK_HREF = "/decks/new";
export const PLAN_HREF = "/settings/plan";

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const OVERVIEW: NavItem = { href: "/overview", label: "Overview", icon: Home, match: (p) => isActivePath(p, "/overview") };
const PRODUCTS: NavItem = {
  href: "/products",
  label: "Products",
  icon: LayoutGrid,
  // Every product page and every deck page (results, boost, share, new deck) belongs to Products.
  match: (p) => isActivePath(p, "/products") || isActivePath(p, "/decks"),
};
const SWIPE: NavItem = { href: "/swipe", label: "Swipe", icon: Layers, match: (p) => isActivePath(p, "/swipe") };
const EARNINGS: NavItem = {
  href: "/wallet",
  label: "Earnings",
  icon: Wallet,
  match: (p) => isActivePath(p, "/wallet") || isActivePath(p, "/history"),
};
const SETTINGS: NavItem = {
  href: "/profile",
  label: "Settings",
  icon: Settings,
  match: (p) => isActivePath(p, "/profile") || isActivePath(p, "/appearance") || isActivePath(p, "/settings"),
};

/** Sidebar (web): five items, no section labels. */
export const NAV_ITEMS: readonly NavItem[] = [OVERVIEW, PRODUCTS, SWIPE, EARNINGS, SETTINGS];

/** Phone bottom tab bar: Swipe · Earnings · Products · Settings. */
export const TAB_ITEMS: readonly NavItem[] = [SWIPE, EARNINGS, PRODUCTS, SETTINGS];

export function isItemActive(pathname: string, item: NavItem): boolean {
  return item.match(pathname);
}

const PRODUCTS_CRUMB: Crumb = { label: "Products", href: "/products" };
const PRODUCT_TABS: Record<string, string> = { tests: "Tests", site: "Website", connect: "Website", config: "Config" };
const DECK_TABS: Record<string, string> = { "who-swiped": "Who swiped", waitlist: "Waitlist", share: "Share" };
const SETTINGS_CRUMB: Crumb = { label: "Settings", href: "/profile" };
const EARNINGS_CRUMB: Crumb = { label: "Earnings", href: "/wallet" };

/** Route-based breadcrumb, used until a page registers real names with useBreadcrumb. Null when there is none. */
export function breadcrumbFor(pathname: string): Crumb[] | null {
  const parts = pathname.split("/").filter(Boolean);
  const [a, b, c] = parts;
  switch (a) {
    case "overview":
      return [{ label: "Overview" }];
    case "swipe":
      return [{ label: "Swipe" }];
    case "wallet":
      return [EARNINGS_CRUMB, { label: "Wallet" }];
    case "history":
      return [EARNINGS_CRUMB, { label: "History" }];
    case "profile":
      return [SETTINGS_CRUMB, { label: "Profile" }];
    case "appearance":
      return [SETTINGS_CRUMB, { label: "Appearance" }];
    case "settings":
      return b === "plan" ? [SETTINGS_CRUMB, { label: "Plan" }] : [{ label: "Settings" }];
    case "products":
      if (!b) return [{ label: "Products" }];
      if (b === "new") return [PRODUCTS_CRUMB, { label: "New product" }];
      return c && PRODUCT_TABS[c]
        ? [PRODUCTS_CRUMB, { label: "Product", href: `/products/${b}` }, { label: PRODUCT_TABS[c] }]
        : [PRODUCTS_CRUMB, { label: "Product" }];
    case "decks":
      if (!b) return [{ label: "Products" }];
      if (b === "new") return [PRODUCTS_CRUMB, { label: "New test" }];
      return c && DECK_TABS[c]
        ? [PRODUCTS_CRUMB, { label: "Test", href: `/decks/${b}` }, { label: DECK_TABS[c] }]
        : [PRODUCTS_CRUMB, { label: "Test" }];
    default:
      return null;
  }
}
