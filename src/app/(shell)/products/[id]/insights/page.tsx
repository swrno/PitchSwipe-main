import { notFound } from "next/navigation";

import { InsightsScreen } from "@/components/insights/insights-screen";
import { isDemoMode } from "@/lib/decks/store";
import { DEMO_OWNER_ID } from "@/lib/decks/store-memory";
import { loadInsights } from "@/lib/insights";

export const dynamic = "force-dynamic";

/**
 * F11 Product insights (phone 25, web 25): what the founder has learned across every deck of one product.
 * Demo mode renders from fixtures on the server; with MongoDB the client loads GET /api/insights/[productId]
 * with the founder's token.
 */
export default async function ProductInsightsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isDemoMode()) return <InsightsScreen productId={id} />;
  const initial = await loadInsights(DEMO_OWNER_ID, id);
  if (!initial) notFound();
  return <InsightsScreen productId={id} initial={initial} />;
}
