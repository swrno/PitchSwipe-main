import { ProductDecks } from "@/features/decks/ui/product-decks";

export const dynamic = "force-dynamic";

/** The product's Tests tab. The client loads the founder's decks from /api/decks?overview=1. */
export default async function ProductTestsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductDecks productId={id} />;
}
