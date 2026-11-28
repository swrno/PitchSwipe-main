import type { Metadata } from "next";
import { LandingNav } from "@/features/landing/ui/landing-nav";
import { FinalCta, Founders, Hero, HowItWorks, Pricing, Swipers } from "@/features/landing/ui/landing-sections";
import { LandingFooter } from "@/features/landing/ui/landing-footer";
import { LandingMotion } from "@/features/landing/ui/landing-motion";
import { MarqueeBand } from "@/features/landing/ui/marquee-band";
import { siteUrl } from "@/features/landing/ui/site-url";

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
        <Hero />
        <MarqueeBand />
        <Founders />
        <HowItWorks />
        <Swipers />
        <Pricing />
        <FinalCta />
      </main>
      <LandingFooter />
      <LandingMotion />
    </>
  );
}
