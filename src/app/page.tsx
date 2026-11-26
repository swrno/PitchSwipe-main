import type { Metadata } from "next";
import { LandingNav } from "@/components/landing/landing-nav";
import { FinalCta, Founders, Hero, HowItWorks, Pricing, Swipers } from "@/components/landing/landing-sections";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingMotion } from "@/components/landing/landing-motion";
import { MarqueeBand } from "@/components/landing/marquee-band";
import { siteUrl } from "@/components/landing/site-url";
import { isDemoMode } from "@/lib/decks/store";

/*
 * Rendered per request: demo mode (PITCHSWIPE_DEMO) is read from the runtime env, and the VM switches it with a
 * restart, not a rebuild. In demo mode the founder buttons skip sign-up and go straight to /decks/new.
 */
export const dynamic = "force-dynamic";

const TITLE = "PitchSwipe: Test your pitch. Then build.";
/*
 * The share image comes from src/app/opengraph-image.tsx. It is named here as well so its URL is resolved against this
 * page's metadataBase and stays on the site origin (the file-based URL alone came out as localhost on the dev server).
 */
const SHARE_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: "PitchSwipe: Test your pitch. Then build." };

const DESCRIPTION =
  "A/B test one thing on your pitch card, like the headline, price or launch reward. Real people swipe, and you see which version makes them sign up.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  // absolute: the root layout's "%s · PitchSwipe" template would add the name a second time.
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "PitchSwipe",
    title: TITLE,
    description: DESCRIPTION,
    images: [SHARE_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [SHARE_IMAGE],
  },
};

/** Public landing page. Only the nav's auth buttons and the theme toggle run on the client. */
export default function LandingPage() {
  const demo = isDemoMode();
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-lime focus:px-4 focus:py-2 focus:font-bold focus:text-ink"
      >
        Skip to content
      </a>
      <LandingNav />
      <main id="main">
        <Hero demo={demo} />
        <MarqueeBand />
        <Founders />
        <HowItWorks />
        <Swipers />
        <Pricing demo={demo} />
        <FinalCta demo={demo} />
      </main>
      <LandingFooter />
      <LandingMotion />
    </>
  );
}
