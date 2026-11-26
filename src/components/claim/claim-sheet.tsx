"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Gift, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { founderFirstName } from "@/lib/claims/client";
import type { CardView } from "@/lib/swipe/types";
import { ProductTile } from "@/components/swipe/deck-card";
import { ModalSheet } from "./modal-sheet";

export interface ClaimSheetProps {
  card: CardView;
  /** Verified email that will be shared. Undefined when the swiper is not signed in. */
  email?: string;
  verified: boolean;
  busy: boolean;
  error: string | null;
  onClaim: () => void;
  onSkip: () => void;
}

/** S7: "Claim it with one tap." Every claim is an explicit tap; the email is shared only with this founder. */
export function ClaimSheet({ card, email, verified, busy, error, onClaim, onSkip }: ClaimSheetProps) {
  const founder = founderFirstName(card.ownerName);
  const canClaim = Boolean(email) && verified;
  return (
    <ModalSheet labelledBy="claim-title" onDismiss={onSkip}>
      {/* Web (design 34): the product, then the reward in the title. */}
      <div className="hidden items-center gap-3 rounded-xl bg-muted p-3 md:flex">
        <ProductTile card={card} className="md:size-11" />
        <div className="min-w-0">
          <p className="truncate font-bold">{card.product.name}</p>
          <p className="truncate text-sm text-muted-foreground" lang={card.lang}>
            {card.headlineLines.filter(Boolean).join(" ")}
          </p>
        </div>
      </div>
      <p className="mt-4 hidden text-xs font-bold uppercase tracking-wide text-accent md:block">
        Launch reward from {founder}
      </p>
      <div className="flex items-center gap-3 rounded-2xl border border-accent/25 bg-accent-soft p-3 md:hidden">
        <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Gift className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-accent">Launch reward from {founder}</p>
          <p className="text-lg font-extrabold leading-tight" lang={card.lang}>
            {card.reward}
          </p>
        </div>
      </div>

      <h2 id="claim-title" className="mt-5 max-w-[11ch] text-3xl leading-[1.05] md:mt-2 md:max-w-none md:text-3xl">
        <span className="hidden md:inline" lang={card.lang}>
          {card.reward}.{" "}
        </span>
        Claim it with one tap.
      </h2>

      <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-border p-3">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted md:hidden">
          <Mail className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="whitespace-nowrap text-sm text-muted-foreground">Will be shared with {founder}</p>
          <p className="truncate text-base font-bold">{email ?? "Sign in to share your email"}</p>
        </div>
        {canClaim ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-sm font-bold text-accent">
            <Check aria-hidden className="size-4" /> Verified
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-base text-muted-foreground">
        {canClaim ? "Your verified email from your profile. " : "Claims use the verified email on your profile. "}
        <Link href={canClaim ? "/profile" : "/signup"} className="font-bold text-foreground underline underline-offset-4">
          {canClaim ? "Change" : "Sign in"}
        </Link>
      </p>

      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        Shared only with {founder}. {founder} will contact you at launch, or before, to give you the reward. The reward
        is {founder}&apos;s promise, not PitchSwipe&apos;s.
      </p>

      {error ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-2 md:flex-row-reverse md:gap-3">
        <Button size="lg" className="w-full rounded-2xl md:flex-1" onClick={onClaim} disabled={busy || !canClaim}>
          <Gift aria-hidden className="md:hidden" />
          {busy ? "Claiming..." : "Claim reward"}
        </Button>
        <Button variant="ghost" size="lg" className="w-full rounded-2xl text-muted-foreground md:flex-1 md:border md:border-border md:text-foreground" onClick={onSkip} disabled={busy}>
          Not now
        </Button>
      </div>
    </ModalSheet>
  );
}
