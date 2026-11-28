import { ProductHeader } from "@/features/decks/ui/product-header";

/** Every page of one product: the shared header with its tabs (Decks, Insights, Website, Settings). */
export default async function ProductLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div>
      <ProductHeader productId={id} />
      {children}
    </div>
  );
}
