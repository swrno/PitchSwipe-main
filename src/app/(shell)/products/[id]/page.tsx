import { notFound } from "next/navigation";
import { ProductScreen } from "@/components/decks/product-screen";
import { FOUNDER } from "@/fixtures";
import { getOverview, getProduct } from "@/lib/decks/service";
import { isDemoMode } from "@/lib/decks/store";
import { DEMO_OWNER_ID } from "@/lib/decks/store-memory";

export const dynamic = "force-dynamic";

/** F2 Product settings. Demo mode renders from fixtures on the server; with MongoDB the client loads it. */
export default async function ProductSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isDemoMode()) return <ProductScreen productId={id} demo={false} />;

  const found = await getProduct(DEMO_OWNER_ID, id);
  if (!found.ok) notFound();
  const overview = await getOverview(DEMO_OWNER_ID);
  const decks = overview.products.find((p) => p.id === id)?.decks ?? [];
  return <ProductScreen productId={id} initial={{ product: found.value, decks }} founderName={FOUNDER.name} demo />;
}
