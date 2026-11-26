import { ProductScreen } from "@/components/decks/product-screen";
import { FOUNDER } from "@/fixtures";
import { isDemoMode } from "@/lib/decks/store";

export const dynamic = "force-dynamic";

export default function NewProductPage() {
  return <ProductScreen founderName={isDemoMode() ? FOUNDER.name : undefined} demo={isDemoMode()} />;
}
