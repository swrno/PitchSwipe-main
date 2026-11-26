import { notFound } from "next/navigation";

import { ResultsScreen } from "@/components/results/results-screen";
import { DEMO_OWNER_ID } from "@/lib/decks/store-memory";
import { isDemoMode } from "@/lib/decks/store";
import { loadResults } from "@/lib/results/load";

export const dynamic = "force-dynamic";

/**
 * F7 / F7b Results for one deck. Demo mode renders from fixtures on the server;
 * with MongoDB the client loads GET /api/results/[deckId] with the founder's token.
 */
export default async function DeckResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isDemoMode()) return <ResultsScreen deckId={id} />;
  const initial = await loadResults(DEMO_OWNER_ID, id);
  if (!initial) notFound();
  return <ResultsScreen deckId={id} initial={initial} />;
}
