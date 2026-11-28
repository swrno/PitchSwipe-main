/** Ping validation, element detection and connection status. Pure. */
import type { PingPayload, SiteElement, SiteRecord, SiteState } from "./types";

export const MAX_ELEMENTS = 50;
export const MAX_VALUE_LENGTH = 500;
export const MAX_PING_BYTES = 8192;
/** No ping for this long and the site is shown as waiting again. */
export const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

const FLAG_RE = /^[A-Za-z0-9_-]{1,100}$/;

const CONTROL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/** Validates what the snippet sent. Unknown shapes return null; bad elements are dropped, never trusted. */
export function parsePing(body: unknown): PingPayload | null {
  let data: unknown = body;
  if (typeof body === "string") {
    if (body.length > MAX_PING_BYTES) return null;
    try {
      data = JSON.parse(body);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object") return null;
  const raw = (data as { elements?: unknown }).elements;
  if (!Array.isArray(raw)) return null;
  const elements: SiteElement[] = [];
  for (const item of raw.slice(0, MAX_ELEMENTS)) {
    if (!item || typeof item !== "object") continue;
    const { flag, value } = item as { flag?: unknown; value?: unknown };
    if (typeof flag !== "string" || !FLAG_RE.test(flag)) continue;
    const text = typeof value === "string" ? value.replace(CONTROL_RE, "").slice(0, MAX_VALUE_LENGTH) : "";
    elements.push({ flagName: flag, currentValue: text });
  }
  return { elements };
}

/** The site after a ping: last seen now, elements replaced by what the page reports. */
export function applyPing(site: SiteRecord, ping: PingPayload, now: Date): SiteRecord {
  return { ...site, lastSeenAt: now.toISOString(), elements: ping.elements };
}

/**
 * waiting: never pinged, or not for 7 days.
 * element_not_found: the snippet runs but no element carries data-pitchswipe.
 * connected: the snippet runs and found at least one marked element.
 */
export function connectionState(site: Pick<SiteRecord, "lastSeenAt" | "elements"> | null, now: Date): SiteState {
  if (!site || !site.lastSeenAt) return "waiting";
  const seen = Date.parse(site.lastSeenAt);
  if (!Number.isFinite(seen) || now.getTime() - seen > STALE_AFTER_MS) return "waiting";
  return site.elements.length === 0 ? "element_not_found" : "connected";
}

/** Deck flags that no element on the site uses (shown as a hint, not an error). */
export function missingFlags(site: Pick<SiteRecord, "elements"> | null, expected: string[]): string[] {
  const found = new Set((site?.elements ?? []).map((e) => e.flagName));
  return expected.filter((f) => !found.has(f));
}

/** "just now", "2 min ago", "3 h ago", "5 days ago". */
export function agoLabel(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "never";
  const ms = now.getTime() - Date.parse(iso);
  if (!Number.isFinite(ms)) return "never";
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}
