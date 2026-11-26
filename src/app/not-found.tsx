import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ArrowChip, Mascot } from "@/components/ui/mascot";
import { BrandMark } from "@/components/shell/brand-mark";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Page not found",
};

/** Site-wide 404. Renders inside the root layout only (no auth, no shell). */
export default function NotFound() {
  return (
    <div className="flex min-h-app flex-col px-4 md:px-6">
      <header className="mx-auto flex w-full max-w-3xl items-center py-4 md:py-6">
        <Link
          href="/"
          aria-label="PitchSwipe home"
          className="inline-flex items-center gap-2.5 rounded-full pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <BrandMark className="size-9" />
          <span className="font-display text-lg font-bold tracking-tight">PitchSwipe</span>
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 items-center pb-16">
        <section aria-labelledby="not-found-title" className="rise-children w-full space-y-4">
          <div className="tile relative overflow-hidden bg-lilac p-6 md:p-10">
            <Mascot mood="wow" color="var(--cream)" back="var(--coral)" className="size-28 md:absolute md:right-8 md:top-8 md:size-44" />
            <span className="mt-4 inline-flex rounded-full bg-ink px-3 py-1 text-xs font-bold text-ink-foreground md:mt-0">Error 404</span>
            <h1 id="not-found-title" className="mt-3 max-w-[12ch] text-[2.3rem] leading-[1.05] md:text-6xl">
              This page swiped left.
            </h1>
            <p className="mt-3 max-w-[38ch] text-base text-ink/75 md:text-lg">
              The link may be old, or the idea may have been taken down. Nothing you did.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/swipe"
                className={cn(buttonVariants({ variant: "ink", size: "lg" }), "justify-between pl-7 pr-3 text-base sm:min-w-64")}
              >
                Swipe new ideas
                <ArrowChip />
              </Link>
              <Link
                href="/"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "border-ink text-ink hover:bg-ink/10 focus-visible:ring-offset-lilac",
                )}
              >
                Go home
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
