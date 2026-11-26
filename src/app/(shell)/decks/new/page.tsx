import { DeckWizard } from "@/components/decks/deck-wizard";
import { getDeck, listProducts } from "@/lib/decks/service";
import { isDemoMode } from "@/lib/decks/store";
import { DEMO_OWNER_ID } from "@/lib/decks/store-memory";

export const dynamic = "force-dynamic";

/**
 * F4 New deck. `?product=<id>` pre-selects the product, `?draft=<id>` reopens a draft
 * (a published deck opens read-only: its cards are locked). Demo mode renders from
 * fixtures on the server; with MongoDB the client loads the founder's data.
 */
export default async function NewDeckPage({ searchParams }: { searchParams: Promise<{ product?: string; draft?: string }> }) {
  const { product, draft } = await searchParams;
  if (!isDemoMode()) return <DeckWizard productId={product} draftId={draft} demo={false} />;

  const initialProducts = await listProducts(DEMO_OWNER_ID);
  const found = draft ? await getDeck(DEMO_OWNER_ID, draft) : undefined;
  return (
    <DeckWizard
      initialProducts={initialProducts}
      initialDraft={found?.ok ? found.value : undefined}
      productId={product}
      draftId={draft}
      demo
    />
  );
}
