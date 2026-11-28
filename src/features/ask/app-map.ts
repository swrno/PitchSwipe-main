/**
 * The app's pages (client-safe, pure). One list drives three things: the `list_pages` tool, the `open_page`
 * path check (only these routes can be opened from the chat), and the "where am I" lookup for the current page.
 * Patterns use `[id]` for one path segment (a product or test id).
 */

export interface AppPage {
  /** Short key, "waitlist". */
  id: string;
  title: string;
  /** "/decks/[id]/waitlist" */
  pattern: string;
  /** One line for "where is X?" answers. */
  about: string;
  /** Which id the [id] segment is. */
  idKind?: "product" | "test";
}

export const APP_PAGES: readonly AppPage[] = [
  { id: "overview", title: "Overview", pattern: "/overview", about: "Your home: what needs attention." },
  { id: "products", title: "Products", pattern: "/products", about: "All your products and their tests." },
  { id: "new_product", title: "New product", pattern: "/products/new", about: "Create a product." },
  { id: "product", title: "Product", pattern: "/products/[id]", about: "One product: its tests, team and audience.", idKind: "product" },
  { id: "product_tests", title: "Product tests", pattern: "/products/[id]/tests", about: "Every test of one product.", idKind: "product" },
  { id: "product_config", title: "Product settings", pattern: "/products/[id]/config", about: "Name, category, industry, audience, founder display.", idKind: "product" },
  { id: "product_site", title: "Website", pattern: "/products/[id]/site", about: "The product's website and what the snippet found.", idKind: "product" },
  { id: "product_connect", title: "Connect website", pattern: "/products/[id]/connect", about: "Connect or change the product's website address.", idKind: "product" },
  { id: "tests", title: "My tests", pattern: "/decks", about: "Every test across your products." },
  { id: "new_test", title: "New test", pattern: "/decks/new", about: "Build a test: variable, versions, audience." },
  { id: "plans", title: "Plan", pattern: "/decks/plans", about: "Your plan and tests left." },
  { id: "results", title: "Results", pattern: "/decks/[id]", about: "Results of one test, with the review and ship screen when decided.", idKind: "test" },
  { id: "audience", title: "Audience and who swiped", pattern: "/decks/[id]/who-swiped", about: "States, sources and who swiped.", idKind: "test" },
  { id: "waitlist", title: "Waitlist", pattern: "/decks/[id]/waitlist", about: "People who joined the waitlist from one test.", idKind: "test" },
  { id: "share", title: "Share", pattern: "/decks/[id]/share", about: "Links and sharing for one test.", idKind: "test" },
  { id: "all_results", title: "All results", pattern: "/results", about: "Results across tests." },
  { id: "insights", title: "Insights", pattern: "/insights", about: "What your tests taught you." },
  { id: "swipe", title: "Swipe", pattern: "/swipe", about: "Swipe on other founders' pitches." },
  { id: "history", title: "History", pattern: "/history", about: "Your past swipes and earnings." },
  { id: "wallet", title: "Earnings", pattern: "/wallet", about: "Your swiper wallet (payouts are coming soon)." },
  { id: "appearance", title: "Appearance", pattern: "/appearance", about: "Light or dark and color themes." },
  { id: "profile", title: "Profile", pattern: "/profile", about: "Your account details." },
  { id: "settings_plan", title: "Plan settings", pattern: "/settings/plan", about: "Plan details." },
];

/** Tabs of a test page, for explaining where things are. */
export const TEST_TABS = [
  { id: "results", label: "Results", suffix: "" },
  { id: "audience", label: "Audience & who swiped", suffix: "/who-swiped" },
  { id: "waitlist", label: "Waitlist users", suffix: "/waitlist" },
  { id: "share", label: "Share", suffix: "/share" },
] as const;
export type TestTab = (typeof TEST_TABS)[number]["id"];

const SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;

const compiled = APP_PAGES.map((p) => ({ page: p, parts: p.pattern.split("/").filter(Boolean) }));

/** Which known page a path is, plus the id in its [id] segment. Null for anything not in the route list. */
export function matchAppPage(pathname: string): { page: AppPage; id: string | null } | null {
  const parts = pathname.split("/").filter(Boolean);
  for (const { page, parts: pat } of compiled) {
    if (pat.length !== parts.length) continue;
    let id: string | null = null;
    let hit = true;
    for (let i = 0; i < pat.length; i++) {
      if (pat[i] === "[id]") {
        if (!SEGMENT.test(parts[i])) hit = false;
        else id = parts[i];
      } else if (pat[i] !== parts[i]) hit = false;
    }
    // "/decks/new" and "/products/new" are fixed pages, not an [id].
    if (hit && !(id === "new" && page.idKind)) return { page, id };
  }
  return null;
}

export type PathCheck = { ok: true; path: string } | { ok: false; error: string };

/**
 * Only an internal path that is in the route list. No scheme, no host, no "//", no ".." and no backslash.
 * A query string is limited to simple key=value pairs; a hash is dropped.
 */
export function validateAppPath(input: unknown): PathCheck {
  if (typeof input !== "string") return { ok: false, error: "Give an app path such as /products." };
  const raw = input.trim();
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("..") || /[\u0000-\u001f\s]/.test(raw)) {
    return { ok: false, error: "Only paths inside the app can be opened." };
  }
  const [beforeHash] = raw.split("#");
  const [path, query] = beforeHash.split("?");
  if (query !== undefined && !/^[A-Za-z0-9_=&.-]{0,120}$/.test(query)) return { ok: false, error: "Only paths inside the app can be opened." };
  const trimmed = path.length > 1 ? path.replace(/\/+$/, "") : path;
  if (!matchAppPage(trimmed)) return { ok: false, error: "That page does not exist in the app. Use list_pages for the real ones." };
  return { ok: true, path: query ? `${trimmed}?${query}` : trimmed };
}

export const testHref = (testId: string, tab: TestTab = "results"): string =>
  `/decks/${encodeURIComponent(testId)}${TEST_TABS.find((t) => t.id === tab)?.suffix ?? ""}`;
export const productHref = (productId: string): string => `/products/${encodeURIComponent(productId)}`;

/** A title for a path, for the page card and the header chip. */
export function pageTitleFor(path: string): string {
  const m = matchAppPage(path.split("?")[0]);
  return m ? m.page.title : "Page";
}

/** Tool names the browser needs to tell apart (client-safe copy; a test keeps it equal to the server registry). */
export const ACTION_NAMES = [
  "create_product",
  "update_product",
  "create_test_draft",
  "publish_test",
  "archive_test",
  "invite_cofounder",
  "remove_cofounder",
  "set_website",
  "remove_website",
] as const;
export const CLIENT_NAMES = ["open_page", "open_download", "set_theme"] as const;
