import { redirect } from "next/navigation";

/** Who swiped now lives on the deck results page. Old links land on its #who-swiped section. */
export default async function WhoSwipedPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const query = tab ? `?tab=${encodeURIComponent(tab)}` : "";
  redirect(`/decks/${encodeURIComponent(id)}${query}#who-swiped`);
}
