"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/provider";
import { BrandMark } from "@/components/shell/brand-mark";

const STEPS = ["Profile", "Verify email", "Practice"] as const;

/**
 * Frame for /practice and /practice/result (designs 30 and 31). Phone: back arrow, logo, "Step 3 of 3" and
 * three green bars. Web: top bar with the 3-step tracker (steps 1-2 ticked) and Sign out, grey page.
 */
export function PracticeShell({
  tracker = false,
  backHref,
  children,
}: {
  /** Show the step tracker and "Step 3 of 3" (practice). The result screen shows neither. */
  tracker?: boolean;
  backHref?: string;
  children: React.ReactNode;
}) {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-app bg-background md:bg-muted">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 pt-5 md:max-w-none md:border-b md:border-border md:bg-background md:px-8 md:pb-4 md:pt-4">
        <div className="flex items-center gap-3">
          {backHref && (
            <Link
              href={backHref}
              aria-label="Back"
              className="grid size-10 place-items-center rounded-full border border-border md:hidden"
            >
              <ArrowLeft className="size-4" />
            </Link>
          )}
          <Link
            href="/swipe"
            className="flex items-center gap-2 rounded-full font-display text-xl font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <BrandMark className="size-9" />
            PitchSwipe
          </Link>
        </div>

        {tracker && (
          <ol className="hidden items-center gap-3 text-sm font-semibold md:flex" aria-label="Progress">
            {STEPS.map((label, i) => {
              const n = i + 1;
              const done = n < 3;
              const current = n === 3;
              return (
                <li key={label} className="flex items-center gap-3" aria-current={current ? "step" : undefined}>
                  {i > 0 && <span className="h-px w-10 bg-accent" />}
                  <span
                    className={cn(
                      "grid size-7 place-items-center rounded-full border text-xs",
                      done && "border-accent bg-accent text-accent-foreground",
                      current && "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    {done ? <Check className="size-4" /> : n}
                  </span>
                  <span>{label}</span>
                </li>
              );
            })}
          </ol>
        )}

        <div className="text-sm font-semibold text-muted-foreground">
          {tracker && <span className="md:hidden">Step 3 of 3</span>}
          {user && (
            <button type="button" onClick={() => void signOut()} className="hidden hover:text-foreground md:inline">
              Sign out
            </button>
          )}
        </div>
      </header>

      {tracker && (
        <div className="mx-auto mt-3 grid max-w-6xl grid-cols-3 gap-2 px-5 md:hidden" aria-hidden>
          {[1, 2, 3].map((n) => (
            <span key={n} className="h-1 rounded-full bg-accent" />
          ))}
        </div>
      )}

      <main className={"mx-auto max-w-5xl px-5 pb-10 pt-6 md:px-8 md:py-12"}>{children}</main>
    </div>
  );
}
