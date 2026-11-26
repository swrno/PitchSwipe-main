import { notFound } from "next/navigation";

import { WhoSwipedScreen } from "@/components/results/who-swiped-screen";
import { DEMO_OWNER_ID } from "@/lib/decks/store-memory";
import { isDemoMode } from "@/lib/decks/store";
import { loadResults } from "@/lib/results/load";
import { WHO_TABS, type WhoTab } from "@/lib/results/types";

export const dynamic = "force-dynamic";

/** F10 Who swiped: Location, Target users, Source, Interests. `?tab=` picks the phone tab. */
export default async function WhoSwipedPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const initialTab: WhoTab = WHO_TABS.find((t) => t === tab) ?? "location";
  if (!isDemoMode()) return <WhoSwipedScreen deckId={id} initialTab={initialTab} />;
  const initial = await loadResults(DEMO_OWNER_ID, id);
  if (!initial) notFound();
  return <WhoSwipedScreen deckId={id} initial={initial} initialTab={initialTab} />;
}
