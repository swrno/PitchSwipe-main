"use client";

import * as React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useAuth } from "@/features/auth/ui/provider";
import { BrandMark } from "@/shared/shell/brand-mark";
import { ArrowChip } from "@/shared/ui/mascot";
import { ThemeToggle } from "@/shared/ui/theme-toggle";
import { buttonVariants } from "@/shared/ui/button";
import { NOT_CONFIGURED_MESSAGE } from "@/shared/lib/config";
import { qualityCheckEnabled } from "@/features/quality/switch";

/** Practice is a sign-up step only while the quality check is on (src/features/quality/server/switch.ts). */
const STEPS: readonly string[] = qualityCheckEnabled() ? ["Profile", "Verify email", "Practice"] : ["Profile", "Verify email"];
const NOTE_TONES = ["bg-card border border-border neutral-ink", "bg-card border border-border neutral-ink", "bg-card border border-border neutral-ink"] as const;

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
  children,
}: {
  step?: 1 | 2;
  title: string;
  intro: React.ReactNode;
  notes?: SideNote[];
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
                  {i > 0 && <span aria-hidden className={cn("h-0.5 w-6 rounded-full", done || current ? "bg-accent" : "bg-border")} />}
                  <span
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-full px-3.5",
                      done && "bg-accent text-accent-foreground",
                      current && "bg-accent text-accent-foreground",
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
              className={cn("hidden h-9 rounded-lg px-3 hover:bg-muted hover:text-foreground md:inline-flex md:items-center", focusRing)}
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
            <span key={n} className={cn("h-1.5 rounded-full", n <= step ? "bg-accent" : "bg-border")} />
          ))}
        </div>
      )}

      <main className="mx-auto grid max-w-6xl gap-6 px-4 pb-12 pt-6 md:px-8 md:pt-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
        <div className="rise-children min-w-0 space-y-6">
          <div>
            {step && (
              <span className="hidden rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground md:inline-flex">
                Step {step} of {STEPS.length}
              </span>
            )}
            <h1 className="text-2xl font-semibold tracking-tight md:text-4xl mt-3">{title}</h1>
            <p className="mt-3 max-w-[52ch] text-base text-muted-foreground">{intro}</p>
          </div>

          <section aria-label={title} className="rounded-3xl bg-card p-5 md:p-5">
            {configured ? children : <Unavailable />}
          </section>
        </div>

        {notes.length > 0 && (
          <aside className="rise-children hidden flex-col gap-3 lg:flex" aria-label="Good to know">
            <p className="text-sm font-semibold">Good to know</p>
            {notes.map((note, i) => (
              <div key={note.title} className={cn("rounded-xl flex gap-3 p-5", NOTE_TONES[i % NOTE_TONES.length])}>
                <span aria-hidden className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground [&_svg]:size-4">
                  {note.icon}
                </span>
                <div>
                  <h2 className="text-sm font-semibold">{note.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{note.body}</p>
                </div>
              </div>
            ))}
          </aside>
        )}
      </main>
    </div>
  );
}

function Unavailable() {
  return (
    <div role="alert" className="rounded-xl border border-warning/40 bg-warning-soft warn-ink p-5 md:p-5">
      <p className="font-display text-xl font-bold">Sign-in is not available right now.</p>
      <p className="mt-1 text-sm text-muted-foreground">{NOT_CONFIGURED_MESSAGE}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/" className={cn(buttonVariants({ variant: "ink" }), "justify-between gap-3 pl-6 pr-2.5")}>
          Back to home
          <ArrowChip />
        </Link>
      </div>
    </div>
  );
}
