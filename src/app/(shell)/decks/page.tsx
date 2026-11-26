import { DecksScreen } from "@/components/decks/decks-screen";
import { DEMO_OWNER_ID } from "@/lib/decks/store-memory";
import { getOverview } from "@/lib/decks/service";
import { isDemoMode } from "@/lib/decks/store";

export const dynamic = "force-dynamic";

/**
 * F1 My decks. In demo mode (no MONGODB_URI) the page renders straight from
 * src/fixtures on the server; with MongoDB the client loads the signed-in
 * founder's decks from /api/decks.
 */
export default async function DecksPage() {
  const initial = isDemoMode() ? await getOverview(DEMO_OWNER_ID) : undefined;
  return <DecksScreen initial={initial} />;
}
