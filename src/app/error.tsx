"use client";

import * as React from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/shared/ui/button";
import { ArrowChip } from "@/shared/ui/mascot";
import { cn } from "@/shared/lib/utils";

/**
 * Error boundary for every route under the root layout. The thrown value is logged to the console and never shown:
 * its message can carry internal details. Only the digest (an opaque hash that matches the server log) is shown.
 */
export default function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  const digest =
    error && typeof error === "object" && "digest" in error && typeof (error as { digest?: unknown }).digest === "string"
      ? (error as { digest: string }).digest
      : null;

  return (
    <div className="flex min-h-[70dvh] items-center px-4 py-10 md:px-6">
      <section aria-labelledby="route-error-title" className="mx-auto w-full max-w-2xl" role="alert">
        <div className="rounded-xl relative overflow-hidden border border-warning/40 bg-warning-soft warn-ink p-5 md:p-5">
          <h1 id="route-error-title" className="mt-3 max-w-[14ch] text-[2rem] leading-[1.05] md:mt-0 md:text-5xl">
            Something went wrong.
          </h1>
          <p className="mt-3 max-w-[38ch] text-base text-muted-foreground">
            This part of PitchSwipe could not load. Try again; if it keeps happening, come back in a few minutes.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button variant="ink" size="lg" className="justify-between pl-7 pr-3 text-base sm:min-w-56" onClick={() => retry()}>
              Try again
              <ArrowChip />
            </Button>
            <Link
              href="/"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "border-ink text-ink hover:bg-ink/10")}
            >
              Go home
            </Link>
          </div>
          {digest ? (
            <p className="mt-4 text-xs font-semibold text-muted-foreground">
              Reference: <span className="tnum break-all">{digest}</span>
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
