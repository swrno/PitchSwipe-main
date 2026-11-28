import { NextResponse } from "next/server";
import { mailerFromEnv } from "@/features/export/server/mailer";
import { readJson, resolveOwnerId, respond } from "@/features/decks/server/owner";
import { inviteMember, listMembers } from "@/features/decks/server/members";
import { limitKey } from "@/shared/lib/ratelimit";

type Ctx = { params: Promise<{ id: string }> };

const NO_STORE = { "cache-control": "no-store" };

/** GET /api/products/[id]/members: the team ({ role, members }). The owner and co-founders can read it. */
export async function GET(request: Request, { params }: Ctx) {
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  const result = await listMembers(who.ownerId, (await params).id);
  return result.ok ? NextResponse.json(result.value, { headers: NO_STORE }) : respond(result);
}

/**
 * POST /api/products/[id]/members { email }: owner only. Emails the invite when RESEND_API_KEY is set; the response
 * always carries `inviteUrl` (and `emailed`) so the owner can copy the link when no email went out.
 */
export async function POST(request: Request, { params }: Ctx) {
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  const limited = limitKey(`members:invite:${who.ownerId}`, { limit: 20, windowMs: 60 * 60_000 }, NO_STORE);
  if (limited) return limited;
  const result = await inviteMember(who.ownerId, (await params).id, await readJson(request), {
    baseUrl: new URL(request.url).origin,
    mailer: mailerFromEnv(),
  });
  return result.ok ? NextResponse.json(result.value, { status: 201, headers: NO_STORE }) : respond(result);
}
