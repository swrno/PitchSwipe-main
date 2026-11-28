import { DeckChrome } from "@/features/results/ui/deck-chrome";

export const dynamic = "force-dynamic";

/**
 * Wraps every deck-level page (results, Who swiped, and pages other packages add under
 * /decks/[id]/) with the header that holds the deck switcher dropdown. The client loads the
 * switcher with the founder's sign-in token from /api/results/[deckId]?view=switcher.
 */
export default async function DeckLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DeckChrome deckId={id}>{children}</DeckChrome>;
}
