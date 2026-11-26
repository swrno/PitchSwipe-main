"use client";

import * as React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/provider";
import { BrandMark } from "@/components/shell/brand-mark";
import { ArrowChip, Mascot } from "@/components/ui/mascot";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/demo-badge";
import { qualityCheckEnabled } from "@/lib/quality/switch";

/** Practice is a sign-up step only while the quality check is on (src/lib/quality/switch.ts). */
const STEPS: readonly string[] = qualityCheckEnabled() ? ["Profile", "Verify email", "Practice"] : ["Profile", "Verify email"];
const NOTE_TONES = ["bg-lilac", "bg-sky", "bg-sun"] as const;

export interface SideNote {
  icon: React.ReactNode;
  title: string;
  body: string;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Shared frame for /signup, /verify, /login and /reset. Black canvas, the card-character logo linking home, a pill step
 * tracker for the 3-step swiper onboarding, the form on a card, and colour-tile notes beside it on wide screens.
 * When Firebase is not configured the form is replaced by a plain "not available" tile; the config details only go
 * to the console (the provider logs them).
 */
export function AuthShell({
  step,
  title,
  intro,
  notes = [],
  preview = false,
  previewHref,
  children,
}: {
  step?: 1 | 2;
  title: string;
  intro: React.ReactNode;
  notes?: SideNote[];
  /** Demo-only layout preview (`?demo=1`): render the form without Firebase. Nothing is submitted. */
  preview?: boolean;
  /** Dev/demo only: where the layout preview lives, offered when sign-in is not configured. */
  previewHref?: string;
  children: React.ReactNode;
}) {
  const { configured, user, signOut } = useAuth();
  return (
    <div className="min-h-app bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-4 md:px-8 md:pt-6">
        <Link href="/" className={cn("flex items-center gap-2 rounded-full font-display text-xl font-bold tracking-tight", focusRing)}>
          <BrandMark className="size-9" />
          PitchSwipe
        </Link>

        {step ? (
          <ol className="hidden items-center gap-2 text-sm font-semibold md:flex" aria-label="Sign-up progress">
            {STEPS.map((label, i) => {
              const n = i + 1;
              const done = n < step;
              const current = n === step;
              return (
                <li key={label} className="flex items-center gap-2" aria-current={current ? "step" : undefined}>
                  {i > 0 && <span aria-hidden className={cn("h-0.5 w-6 rounded-full", done || current ? "bg-lime" : "bg-border")} />}
                  <span
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-full px-3.5",
                      done && "bg-lime text-ink",
                      current && "bg-highlight text-highlight-foreground",
                      !done && !current && "border-2 border-border text-muted-foreground",
                    )}
                  >
                    {done ? <Check aria-hidden className="size-4" strokeWidth={3} /> : <span className="tnum">{n}</span>}
                    {label}
                    {done && <span className="sr-only">(done)</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : null}

        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          {step && <span className="md:hidden">Step {step} of {STEPS.length}</span>}
          {user && (
            <button
              type="button"
              onClick={() => void signOut()}
              className={cn("hidden h-9 rounded-full px-3 hover:bg-muted hover:text-foreground md:inline-flex md:items-center", focusRing)}
            >
              Sign out
            </button>
          )}
          <ThemeToggle />
        </div>
      </header>

      {step && (
        <div className="mx-auto mt-3 grid max-w-6xl gap-2 px-4 md:hidden" style={{ gridTemplateColumns: `repeat(${STEPS.length}, minmax(0, 1fr))` }} aria-hidden>
          {STEPS.map((_, i) => i + 1).map((n) => (
            <span key={n} className={cn("h-1.5 rounded-full", n <= step ? "bg-lime" : "bg-border")} />
          ))}
        </div>
      )}

      <main className="mx-auto grid max-w-6xl gap-6 px-4 pb-12 pt-6 md:px-8 md:pt-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
        <div className="rise-children min-w-0 space-y-6">
          <div>
            {step && (
              <span className="hidden rounded-full bg-ink px-3 py-1 text-xs font-bold text-ink-foreground ring-1 ring-border md:inline-flex">
                Step {step} of {STEPS.length}
              </span>
            )}
            <h1 className="mt-3 text-[2.1rem] leading-[1.05] md:text-6xl">{title}</h1>
            <p className="mt-3 max-w-[52ch] text-base text-muted-foreground">{intro}</p>
          </div>

          <section aria-label={title} className="rounded-3xl bg-card p-5 md:p-8">
            {preview ? (
              <DemoBadge className="mb-5">Layout preview: demo data, nothing is sent</DemoBadge>
            ) : null}
            {configured || preview ? children : <Unavailable previewHref={previewHref} />}
          </section>
        </div>

        {notes.length > 0 && (
          <aside className="rise-children hidden flex-col gap-3 lg:flex" aria-label="Good to know">
            <div className="tile relative flex h-36 items-end overflow-hidden bg-lime p-5">
              <Mascot mood="happy" color="var(--cream)" back="var(--sky)" className="absolute -right-1 -top-1 size-28" />
              <p className="max-w-[12ch] font-display text-2xl font-bold leading-tight">Good to know</p>
            </div>
            {notes.map((note, i) => (
              <div key={note.title} className={cn("tile flex gap-3 p-5", NOTE_TONES[i % NOTE_TONES.length])}>
                <span aria-hidden className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-ink text-ink-foreground [&_svg]:size-4">
                  {note.icon}
                </span>
                <div>
                  <h2 className="text-base font-bold">{note.title}</h2>
                  <p className="mt-1 text-sm text-ink/75">{note.body}</p>
                </div>
              </div>
            ))}
          </aside>
        )}
      </main>
    </div>
  );
}

function Unavailable({ previewHref }: { previewHref?: string }) {
  return (
    <div role="alert" className="tile bg-coral p-5 md:p-6">
      <p className="font-display text-xl font-bold">Sign-in is not available right now.</p>
      <p className="mt-1 text-sm text-ink/75">Try again in a little while.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/" className={cn(buttonVariants({ variant: "ink" }), "justify-between gap-3 pl-6 pr-2.5")}>
          Back to home
          <ArrowChip />
        </Link>
        {previewHref ? (
          <Link href={previewHref} className={cn(buttonVariants({ variant: "ghost" }), "text-ink hover:bg-ink/10")}>
            Open the layout preview
          </Link>
        ) : null}
      </div>
    </div>
  );
}
