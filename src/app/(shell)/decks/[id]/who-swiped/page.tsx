import { WhoSwipedScreen } from "@/features/results/ui/who-swiped-screen";

export const dynamic = "force-dynamic";
export const metadata = { title: "Who swiped · PitchSwipe" };

/** Who swiped on this test: location, target users, source and interests. The client loads the results. */
export default async function WhoSwipedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WhoSwipedScreen deckId={id} />;
}
