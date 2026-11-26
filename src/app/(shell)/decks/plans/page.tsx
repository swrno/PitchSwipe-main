import { Check } from "lucide-react";
import { SubPageNav } from "@/components/decks/ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DECK_PLANS } from "@/fixtures";
import { isDemoMode } from "@/lib/decks/store";
import { cn } from "@/lib/utils";

/**
 * F3 Deck plans (phone 04, web 06). Pitch only: static UI, nothing can be bought
 * and no deck allowance is enforced.
 */
export const dynamic = "force-dynamic";

export default function DeckPlansPage() {
  // The "7 of 10" meter is the designed demo figure. Billing is not built, so real founders get no counter
  // and no "Current plan" badge: there is no real plan to point at.
  const demo = isDemoMode();
  const used = DECK_PLANS.decksTotal - DECK_PLANS.decksLeft;
  const percent = Math.round((used / DECK_PLANS.decksTotal) * 100);
  return (
    <div className="space-y-5">
      <SubPageNav
        backHref="/decks"
        crumbs="Decks / Plans"
        right={demo ? `${DECK_PLANS.decksLeft} of ${DECK_PLANS.decksTotal} decks left` : undefined}
      />
      <div>
        <h1 className="text-4xl md:text-5xl">Deck plans</h1>
        <p className="mt-2 text-muted-foreground">
          One deck = one test with 2 or 3 versions.
          <span className="hidden md:inline"> Boost is bought per deck, on the deck&apos;s Audience and Boost page.</span>
        </p>
      </div>

      <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground md:max-w-[45rem]">
        Pitch only: billing is not built yet, so nothing here can be bought and no deck limit is enforced.
      </p>

      {demo ? (
      <div className="rounded-xl bg-muted p-4 md:max-w-[45rem] md:border md:border-border md:bg-card">
        <div className="mb-3 flex items-center justify-between font-bold">
          <span>
            {used} of {DECK_PLANS.decksTotal} decks used
          </span>
          <span className="font-medium text-muted-foreground">{DECK_PLANS.decksLeft} left</span>
        </div>
        <div className="h-2.5 rounded-full bg-border" role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={DECK_PLANS.decksTotal}>
          <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
        </div>
      </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Plan name="Free" price="Rs 0" perks={["1 live deck", "Personal link only"]} />
        <Plan
          name="10 decks"
          price="Rs 200"
          unit="Rs 20 a deck"
          perks={["Listed in the swipe feed", "Free audience targeting", "AI drafting and AI preview"]}
          current={demo}
          action={demo ? "Buy again" : "Buy 10 decks"}
        />
        <Plan
          name="100 decks"
          price="Rs 1,600"
          unit="Rs 16 a deck"
          perks={["Everything in 10 decks", "For founders testing many ideas or products"]}
          badge="Save 20%"
          action="Buy 100 decks"
          primary
        />
      </div>

      <p className="text-center text-sm text-muted-foreground md:hidden">
        Boost is bought per deck, on the deck&apos;s Audience and Boost page. Prices are placeholders.
      </p>
      <p className="hidden text-sm text-muted-foreground md:block">Prices are placeholders for the hackathon demo.</p>
    </div>
  );
}

function Plan({
  name,
  price,
  unit,
  perks,
  current,
  badge,
  action,
  primary,
}: {
  name: string;
  price: string;
  unit?: string;
  perks: string[];
  current?: boolean;
  badge?: string;
  action?: string;
  primary?: boolean;
}) {
  return (
    <Card className={cn("flex flex-col p-5", current && "border-2 border-accent", primary && "border-2 border-foreground")}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-extrabold">{name}</h2>
        {current ? <span className="rounded-md bg-accent-soft px-2.5 py-1 text-sm font-bold text-accent">Current plan</span> : null}
        {badge ? <span className="rounded-md bg-primary px-2.5 py-1 text-sm font-bold text-primary-foreground">{badge}</span> : null}
      </div>
      <p className="mb-4 flex flex-wrap items-baseline gap-x-2 text-4xl font-extrabold tracking-tight">
        {price}{unit ? <span className="text-base font-medium text-muted-foreground">{unit}</span> : null}
      </p>
      <ul className="mb-5 space-y-2.5 md:min-h-[8.5rem]">
        {perks.map((perk) => (
          <li key={perk} className="flex items-center gap-3">
            <Check className="size-4 text-accent" /> {perk}
          </li>
        ))}
      </ul>
      {action ? (
        <Button
          variant={primary ? "default" : "outline"}
          className="mt-auto w-full md:w-fit"
          aria-disabled type="button"
          title="Billing is not built yet (Pitch only)"
        >
          {action}
        </Button>
      ) : null}
    </Card>
  );
}
