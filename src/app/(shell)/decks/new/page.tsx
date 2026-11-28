import { DeckWizard } from "@/features/decks/ui/deck-wizard";

export const dynamic = "force-dynamic";

/**
 * F4 New deck. `?product=<id>` pre-selects the product, `?draft=<id>` reopens a draft
 * (a published deck opens read-only: its cards are locked). The client loads the founder's data.
 */
export default async function NewDeckPage({ searchParams }: { searchParams: Promise<{ product?: string; draft?: string }> }) {
  const { product, draft } = await searchParams;
  return <DeckWizard productId={product} draftId={draft} startWithIdea={!draft && !product} />;
}
