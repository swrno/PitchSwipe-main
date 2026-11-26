import { notFound } from "next/navigation";

import { AskScreen } from "@/components/ask/ask-screen";
import { buildAskContext, contextHeader, suggestedQuestions } from "@/lib/ask";
import { isDemoMode } from "@/lib/decks/store";
import { DEMO_OWNER_ID } from "@/lib/decks/store-memory";

export const dynamic = "force-dynamic";

/**
 * F12 Ask your results. The design index lists /products/[id]/ask; the deck chrome (switcher) lives under
 * /decks/[id], so the chat is here and answers about the whole product (every deck the switcher lists).
 * Demo mode renders the header and suggested questions from fixtures on the server; with MongoDB the client
 * loads them from GET /api/ask with the founder's token.
 */
export default async function AskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isDemoMode()) return <AskScreen deckId={id} />;
  const ctx = await buildAskContext(DEMO_OWNER_ID, id);
  if (!ctx) notFound();
  return <AskScreen deckId={id} initial={{ header: contextHeader(ctx), suggestions: suggestedQuestions(ctx) }} />;
}
