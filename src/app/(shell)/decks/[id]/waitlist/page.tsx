import { WaitlistScreen } from "@/features/results/ui/waitlist-screen";

export const dynamic = "force-dynamic";
export const metadata = { title: "Waitlist users · PitchSwipe" };

/** The test's waitlist: everyone who claimed the reward. The client loads it with the founder's token. */
export default async function WaitlistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WaitlistScreen deckId={id} />;
}
