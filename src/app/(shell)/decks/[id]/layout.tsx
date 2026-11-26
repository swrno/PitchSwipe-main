import { DeckChrome } from "@/components/results/deck-chrome";
import { DEMO_OWNER_ID } from "@/lib/decks/store-memory";
import { isDemoMode } from "@/lib/decks/store";
import { loadSwitcher } from "@/lib/results/load";

export const dynamic = "force-dynamic";

/**
 * Wraps every deck-level page (results, Who swiped, and pages other packages add under
 * /decks/[id]/) with the header that holds the deck switcher dropdown. In demo mode the
 * switcher is rendered from fixtures on the server; with MongoDB the client loads it with the
 * founder's sign-in token from /api/results/[deckId]?view=switcher.
 */
export default async function DeckLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initial = isDemoMode() ? await loadSwitcher(DEMO_OWNER_ID, id) : undefined;
  return (
    <DeckChrome deckId={id} initial={initial}>
      {children}
    </DeckChrome>
  );
}
