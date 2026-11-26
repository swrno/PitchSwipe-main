import { headers } from "next/headers";
import { BoostScreen, type BoostData } from "@/components/share/boost-screen";
import { getDeck, getProduct } from "@/lib/decks/service";
import { isDemoMode } from "@/lib/decks/store";
import { DEMO_OWNER_ID } from "@/lib/decks/store-memory";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audience and Boost · PitchSwipe" };

async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * F6 Audience and Boost. Demo mode renders from fixtures on the server; with MongoDB the
 * client loads the founder's deck and product with their sign-in token.
 */
export default async function BoostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const origin = await siteOrigin();
  if (!isDemoMode()) return <BoostScreen deckId={id} origin={origin} demo={false} />;

  const deck = await getDeck(DEMO_OWNER_ID, id);
  const product = deck.ok ? await getProduct(DEMO_OWNER_ID, deck.value.productId) : undefined;
  if (!deck.ok || !product?.ok) {
    return <p className="text-muted-foreground">Deck not found.</p>;
  }
  const initial: BoostData = {
    deck: { _id: deck.value._id, slug: deck.value.slug, variable: deck.value.variable },
    product: product.value,
  };
  return <BoostScreen deckId={id} origin={origin} initial={initial} demo />;
}
