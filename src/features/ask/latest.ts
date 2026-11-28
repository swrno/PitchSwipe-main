import { listDecks } from "@/features/decks/server/service";

const objectIdTime = (id: string) => (/^[0-9a-f]{24}$/i.test(id) ? parseInt(id.slice(0, 8), 16) : -1);

/** The founder's newest deck id (ObjectId time; fixtures keep list order), or null when they have none. */
export async function newestDeckId(ownerId: string): Promise<string | null> {
  const decks = await listDecks(ownerId);
  if (decks.length === 0) return null;
  let best = decks[0];
  for (const d of decks) if (objectIdTime(String(d._id)) > objectIdTime(String(best._id))) best = d;
  return String(best._id);
}
