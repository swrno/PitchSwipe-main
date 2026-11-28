import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { SwipeExperience } from "@/features/swipe/ui/swipe-experience";
import { composeCard } from "@/features/swipe/card";
import { ServiceUnavailableError } from "@/features/swipe/errors";
import { getSwipeStore } from "@/features/swipe/server/store";

type Params = Promise<{ slug: string }>;

/** null when the deck is missing; "unavailable" when the backend is not configured (production without MONGODB_URI). */
async function loadDeck(slug: string) {
  try {
    const store = await getSwipeStore();
    return await store.getDeckBySlug(slug);
  } catch (error) {
    if (error instanceof ServiceUnavailableError) return "unavailable" as const;
    throw error;
  }
}

/** The text a link preview shows: the control card, so every visitor's unfurl is the same. */
async function previewFor(slug: string) {
  const deck = await loadDeck(slug);
  if (!deck || deck === "unavailable" || deck.cards.length === 0) return null;
  const card = composeCard(deck, deck.cards[0], { source: "link", paid: false, paidRs: 0, counting: true });
  return { deck, card };
}

async function siteOrigin(): Promise<string | undefined> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  // Never build absolute URLs from request headers in production (host-header injection, cache poisoning).
  if (process.env.NODE_ENV === "production") return undefined;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Open Graph + Twitter tags so a WhatsApp / LinkedIn paste unfurls as a card. The image is ./opengraph-image. */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const preview = await previewFor(slug);
  if (!preview) return { title: "Idea not found" };
  const { card, deck } = preview;
  const title = `${deck.product.name}: ${card.headline}`;
  const description = card.description || `Give your honest take on ${deck.product.name} in about 10 seconds.`;
  const origin = await siteOrigin();
  return {
    ...(origin ? { metadataBase: new URL(origin) } : {}),
    title,
    description,
    alternates: { canonical: `/d/${slug}` },
    openGraph: {
      type: "website",
      siteName: "PitchSwipe",
      url: `/d/${slug}`,
      title,
      description,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

/**
 * Personal share link: opens the swipe feed with this deck first, then the random feed.
 * Link visitors need no sign-up. They answer without the quality check, tagged "Your link (not
 * verified)", and are never paid.
 */
export default async function DeckLinkPage({ params }: { params: Params }) {
  const { slug } = await params;
  const deck = await loadDeck(slug);
  if (deck === "unavailable") {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Temporarily unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">This service is temporarily unavailable. Please try again later.</p>
      </main>
    );
  }
  if (!deck) notFound();

  return (
    <div className="min-h-app bg-background">
      <header className="mx-auto flex h-14 w-full max-w-md items-center px-4 md:max-w-5xl md:px-10">
        <span className="flex items-center gap-2 text-base font-extrabold tracking-tight">
          <span aria-hidden className="size-6 rounded-md bg-accent" />
          PitchSwipe
        </span>
      </header>
      <main className="mx-auto w-full max-w-md px-4 pb-10 pt-2 md:max-w-5xl md:px-10 md:pt-6">
        <SwipeExperience mode="link" firstSlug={slug} />
      </main>
    </div>
  );
}
