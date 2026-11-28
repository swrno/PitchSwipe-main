import { resolveOwnerId, respond } from "@/features/decks/server/owner";
import { removeMember } from "@/features/decks/server/members";
import { limitKey } from "@/shared/lib/ratelimit";

type Ctx = { params: Promise<{ id: string; memberId: string }> };

/** DELETE /api/products/[id]/members/[memberId]: owner only. Removing a co-founder (or cancelling an invite) ends their access at once. */
export async function DELETE(request: Request, { params }: Ctx) {
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  const limited = limitKey(`members:remove:${who.ownerId}`, { limit: 60, windowMs: 60_000 });
  if (limited) return limited;
  const { id, memberId } = await params;
  return respond(await removeMember(who.ownerId, id, memberId));
}
