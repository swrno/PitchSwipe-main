import { ResultsScreen } from "@/features/results/ui/results-screen";

export const dynamic = "force-dynamic";

/** F7 / F7b Results for one deck. The client loads GET /api/results/[deckId] with the founder's token. */
export default async function DeckResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResultsScreen deckId={id} />;
}
