/**
 * Co-founder use-cases (server only): invite by email, list, remove, accept. Only the owner manages the team; a
 * co-founder may list it. The invite token is random, only its sha-256 is stored, and it works once within 14 days.
 */
import { productAccess } from "./access";
import { getStore, type Store } from "./store";
import {
  hashInviteToken,
  INVITE_TTL_MS,
  isInviteTokenShape,
  newInviteToken,
  normalizeEmail,
  toMemberView,
  type MemberView,
  type ProductAccess,
} from "../members";
import type { ServiceResult } from "./service";

type Status = 400 | 403 | 404 | 409 | 410 | 422;
const fail = (status: Status, error: string): ServiceResult<never> => ({ ok: false, status, error });
const ok = <T,>(value: T): ServiceResult<T> => ({ ok: true, value });

export interface Mail {
  send(message: { to: string; subject: string; text: string; attachments: [] }): Promise<void>;
}

/** The invite link path. The page at /invite/[token] signs the person in if needed, then accepts. */
export const invitePath = (token: string) => `/invite/${token}`;

export async function listMembers(actorId: string, productId: string, store?: Store): Promise<ServiceResult<{ role: Exclude<ProductAccess, null>; members: MemberView[] }>> {
  const s = store ?? (await getStore());
  const role = await productAccess(actorId, productId, s);
  if (!role) return fail(404, "Product not found.");
  const now = new Date();
  return ok({ role, members: (await s.listMembers(productId)).map((m) => toMemberView(m, now)) });
}

export interface InviteResult {
  member: MemberView;
  /** Absolute link. The owner can copy it when no email could be sent. */
  inviteUrl: string;
  emailed: boolean;
}

export async function inviteMember(
  actorId: string,
  productId: string,
  body: unknown,
  opts: { baseUrl: string; mailer?: Mail | null; store?: Store; now?: Date },
): Promise<ServiceResult<InviteResult>> {
  const s = opts.store ?? (await getStore());
  const role = await productAccess(actorId, productId, s);
  if (!role) return fail(404, "Product not found.");
  if (role !== "owner") return fail(403, "Only the owner can manage the team.");
  const email = normalizeEmail(typeof body === "object" && body !== null ? (body as { email?: unknown }).email : undefined);
  if (!email) return fail(422, "Enter a valid email address.");
  const product = await s.getProduct(actorId, productId);
  if (!product) return fail(404, "Product not found.");

  const now = opts.now ?? new Date();
  const token = newInviteToken();
  const member = await s.inviteMember({
    productId,
    email,
    role: "cofounder",
    status: "invited",
    tokenHash: hashInviteToken(token),
    invitedBy: actorId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
  });
  if (!member) return fail(409, "That person is already a co-founder.");

  const inviteUrl = `${opts.baseUrl.replace(/\/$/, "")}${invitePath(token)}`;
  let emailed = false;
  if (opts.mailer) {
    try {
      await opts.mailer.send({
        to: email,
        subject: `You are invited to ${product.name} on PitchSwipe`,
        text: `You were invited as a co-founder of ${product.name} on PitchSwipe. You will see its tests, results and insights, and can build tests with the team.\n\nAccept (sign in with this email address): ${inviteUrl}\n\nThe link works once and expires in 14 days.`,
        attachments: [],
      });
      emailed = true;
    } catch (error) {
      console.error("members: invite email failed", error instanceof Error ? error.message : error);
    }
  }
  return ok({ member: toMemberView(member, now), inviteUrl, emailed });
}

export async function removeMember(actorId: string, productId: string, memberId: string, store?: Store): Promise<ServiceResult<{ removed: true }>> {
  const s = store ?? (await getStore());
  const role = await productAccess(actorId, productId, s);
  if (!role) return fail(404, "Product not found.");
  if (role !== "owner") return fail(403, "Only the owner can manage the team.");
  return (await s.removeMember(productId, memberId)) ? ok({ removed: true }) : fail(404, "Member not found.");
}

export interface Acceptor {
  /** The signed-in founder's user id (resolveOwnerId). */
  uid: string;
  /** From the verified Firebase token, never from the request body. */
  email: string | null | undefined;
  emailVerified: boolean;
}

export async function acceptInvite(actor: Acceptor, token: unknown, opts: { store?: Store; now?: Date } = {}): Promise<ServiceResult<{ productId: string }>> {
  const gone = "This invite link is not valid, or it was already used.";
  if (!isInviteTokenShape(token)) return fail(404, gone);
  const s = opts.store ?? (await getStore());
  const now = opts.now ?? new Date();
  const member = await s.findMemberByTokenHash(hashInviteToken(token));
  if (!member || member.status !== "invited") return fail(404, gone);
  if (member.expiresAt.getTime() <= now.getTime()) return fail(410, "This invite has expired. Ask the owner to invite you again.");
  if (!actor.emailVerified || !actor.email) return fail(403, "Verify your email address first.");
  if (actor.email.trim().toLowerCase() !== member.email) return fail(403, "This invite was sent to a different email address. Sign in with the address it was sent to.");
  if ((await productAccess(actor.uid, member.productId, s)) === "owner") return fail(409, "You already own this product.");
  const accepted = await s.acceptMember(member.id, actor.uid, now);
  if (!accepted) return fail(410, "This invite was already used or has expired.");
  return ok({ productId: accepted.productId });
}
