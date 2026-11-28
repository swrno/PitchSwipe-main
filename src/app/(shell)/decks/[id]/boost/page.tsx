import { BoostScreen } from "@/features/share/ui/boost-screen";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audience and Boost · PitchSwipe" };

/** F6 Audience and Boost. The client loads the founder's deck and product with their sign-in token. */
export default async function BoostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BoostScreen deckId={id} />;
}
