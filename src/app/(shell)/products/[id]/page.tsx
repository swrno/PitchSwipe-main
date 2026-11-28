import { ProductOverview } from "@/features/decks/ui/product-overview";

export const dynamic = "force-dynamic";

/** The product's Overview tab: a summary built from the decks overview and each test's results. No AI calls. */
export default async function ProductOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductOverview productId={id} />;
}
