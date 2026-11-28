import { InsightsScreen } from "@/features/insights/ui/insights-screen";

export const dynamic = "force-dynamic";

/**
 * F11 Product insights (phone 25, web 25): what the founder has learned across every deck of one product.
 * The client loads GET /api/insights/[productId] with the founder's token.
 */
export default async function ProductInsightsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InsightsScreen productId={id} />;
}
