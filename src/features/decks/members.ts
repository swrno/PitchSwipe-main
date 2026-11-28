/**
 * Product members (co-founders): the pure rules. No I/O. A founder invites a friend by email; the friend gets a link
 * with a random token, and only the sha-256 of that token is stored.
 */
import { createHash, randomBytes } from "node:crypto";

export const MEMBER_ROLES = ["cofounder"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];
export type MemberStatus = "invited" | "active";

/** What a person may do with a product: the owner manages it, a co-founder sees and works on it, anyone else nothing. */
export type ProductAccess = "owner" | "cofounder" | null;

/** An invite link works for 14 days. */
export const INVITE_TTL_MS = 14 * 24 * 60 * 60_000;

export interface MemberRecord {
  id: string;
  productId: string;
  /** Lowercased. */
  email: string;
  /** The accepting founder's user id; set when the invite is accepted. */
  uid?: string;
  role: MemberRole;
  status: MemberStatus;
  /** sha-256 hex of the invite token; removed once the invite is accepted (single use). */
  tokenHash?: string;
  invitedBy: string;
  createdAt: Date;
  acceptedAt?: Date;
  expiresAt: Date;
}

/** What the API and UI see: never the token hash. */
export interface MemberView {
  id: string;
  email: string;
  role: MemberRole;
  status: MemberStatus;
  /** An invite past its expiry date (the link no longer works; invite again to refresh it). */
  expired: boolean;
  createdAt: string;
  acceptedAt?: string;
  expiresAt?: string;
}

export function newInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A token as `newInviteToken` makes it (43 url-safe characters). Anything else is refused before any lookup. */
export function isInviteTokenShape(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]+$/.test(email)) return null;
  return email;
}

export function toMemberView(m: MemberRecord, now: Date = new Date()): MemberView {
  return {
    id: m.id,
    email: m.email,
    role: m.role,
    status: m.status,
    expired: m.status === "invited" && m.expiresAt.getTime() <= now.getTime(),
    createdAt: m.createdAt.toISOString(),
    acceptedAt: m.acceptedAt?.toISOString(),
    expiresAt: m.status === "invited" ? m.expiresAt.toISOString() : undefined,
  };
}
