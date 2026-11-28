import { ProductScreen } from "@/features/decks/ui/product-screen";
import { TeamPanel } from "@/features/decks/ui/team-panel";

export const dynamic = "force-dynamic";

/** F2 Product config: the product's details, then its team (invite co-founders by email). */
export default async function ProductConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductScreen productId={id} aside={<TeamPanel productId={id} />} />;
}
