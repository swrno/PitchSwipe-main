import { AudioLines, Gift, Heart } from "lucide-react";
import { Mascot } from "@/shared/ui/mascot";

/**
 * A pitch card drawn as plain markup for the hero. It is an illustration (copy from docs/marketing/index.html), not a
 * real deck, so it carries a visible "Example" tag and nothing on it is interactive.
 */
export function ExampleCard() {
  return (
    // data-parallax: the stack drifts up a little as the page scrolls (landing-motion.tsx).
    <figure data-parallax="36" className="relative mx-auto w-full max-w-[22rem] pt-10 will-change-transform md:max-w-[24rem]">
      {/* The cards behind, like the stack a swiper sees. */}
      <div aria-hidden className="tile absolute inset-x-2 bottom-1 top-14 -translate-x-3 -rotate-[8deg] bg-card border border-border neutral-ink" />
      <div aria-hidden className="tile absolute inset-x-2 bottom-2 top-12 translate-x-3 rotate-[5deg] bg-card border border-border neutral-ink" />

      <Mascot
        mood="wink"
        color="var(--cream)"
        back="var(--accent)"
        className="float absolute -top-2 right-2 z-20 size-24 rotate-6 [--float-delay:-1.5s] md:-right-6 md:size-28"
      />

      {/* hero-swipe: every few seconds the card leans into a "yes" and a heart stamp pops (globals.css). */}
      <div className="hero-swipe tile relative z-10 bg-card neutral-ink p-5 shadow-2xl shadow-black/40 md:p-6">
        <span
          aria-hidden
          className="hero-stamp pointer-events-none absolute left-1/2 top-1/2 z-10 -ml-9 -mt-9 flex size-[72px] items-center justify-center rounded-full bg-lime text-ink shadow-xl ring-4 ring-ink"
        >
          <Heart className="size-9 fill-current" />
        </span>
        <span className="inline-flex rounded-full bg-ink px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink-foreground">
          Example
        </span>

        <div className="mt-4 flex items-center gap-3">
          <span aria-hidden className="flex size-11 items-center justify-center rounded-2xl bg-lime">
            <AudioLines className="size-6" strokeWidth={2.5} />
          </span>
          <div>
            <p className="font-display text-lg font-bold leading-tight">Voice Khata</p>
            <p className="text-xs font-semibold text-ink/60">Voice ledger · Retail</p>
          </div>
        </div>

        <p className="mt-4 font-display text-2xl font-bold leading-tight tracking-tight">
          Speak your sales.
          <br />
          <span className="accent-underline">The ledger writes itself.</span>
        </p>
        <p className="mt-2 text-sm text-ink/70">
          Say who bought on credit and Voice Khata records it, tracks dues and reminds buyers politely.
        </p>

        <p className="mt-4 rounded-2xl bg-ink/[0.06] px-4 py-3 text-sm font-bold">Would you pay Rs 299 a month for this?</p>

        <div aria-hidden className="mt-3 grid grid-cols-2 gap-2 text-sm font-bold">
          <span className="flex h-10 items-center justify-center rounded-full border-2 border-ink">No</span>
          <span className="flex h-10 items-center justify-center rounded-full bg-ink text-ink-foreground">Yes</span>
        </div>

        <p className="mt-3 flex items-center justify-center gap-2 rounded-full bg-lime px-4 py-2.5 text-sm font-bold">
          <Gift aria-hidden className="size-4" strokeWidth={2.5} />
          Get 3 months free at launch
        </p>
      </div>
      <figcaption className="sr-only">
        Example pitch card for a made-up product, Voice Khata: a headline, a short description, the question &quot;Would
        you pay Rs 299 a month for this?&quot;, yes and no answers, and a launch reward of 3 months free.
      </figcaption>
    </figure>
  );
}
