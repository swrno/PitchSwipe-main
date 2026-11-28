import { siteOrigin } from "@/features/share/server/origin";
import { ShareScreen } from "@/features/share/ui/share-screen";

export const dynamic = "force-dynamic";
export const metadata = { title: "Share · PitchSwipe" };

/** The deck's personal link, WhatsApp, LinkedIn and QR code. The client loads the founder's deck and product. */
export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const origin = await siteOrigin();
  return <ShareScreen deckId={id} origin={origin} />;
}
