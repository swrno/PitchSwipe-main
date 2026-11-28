import type { Crumb } from "./breadcrumb";

/** Tabs of one top-level page: moving between them is not "going back". */
const TAB_GROUPS: readonly (readonly string[])[] = [
  ["/profile", "/appearance", "/settings/plan"],
  ["/wallet", "/history"],
];

/** Last URL segments that are tabs of a product or a test (docs/information-architecture.md). */
const TAB_SEGMENTS = new Set(["insights", "site", "settings", "waitlist", "who-swiped", "boost", "share"]);

const inGroup = (path: string, group: readonly string[]) => group.some((p) => path === p || path.startsWith(`${p}/`));

/**
 * Where "back" goes from `pathname`, given its breadcrumb. A tab page (e.g. a test's Share tab) belongs to the item
 * that owns the tabs, so back skips that item and goes to its parent: Share → the product; a product's Insights →
 * Products. Any other page goes back to the previous crumb. Top-level pages and sibling tabs of one top-level page
 * (Settings, Earnings) get no back target.
 */
export function parentOf(pathname: string, crumbs: readonly Crumb[] | null): Crumb | null {
  if (!crumbs || crumbs.length < 2) return null;
  if (TAB_GROUPS.some((g) => inGroup(pathname, g))) return null;
  const last = pathname.split("/").filter(Boolean).at(-1) ?? "";
  const owner = crumbs.at(-2);
  const isTab = TAB_SEGMENTS.has(last) && !!owner?.href && pathname.startsWith(`${owner.href}/`);
  const target = isTab ? crumbs.at(-3) : owner;
  return target?.href ? target : null;
}
