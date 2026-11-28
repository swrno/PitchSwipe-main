import { DecksScreen } from "@/features/decks/ui/decks-screen";

export const dynamic = "force-dynamic";
export const metadata = { title: "Products" };

/** The founder's products, each with its decks. The client loads them from /api/decks?overview=1. */
export default function ProductsPage() {
  return <DecksScreen />;
}
