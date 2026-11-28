import { Icon, IconLabel } from "@/shared/ui/icon";
import { Check } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { DecksLeftCard } from "@/features/decks/ui/decks-left";
import { cn } from "@/shared/lib/utils";

/**
 * F3 Deck plans (phone 04, web 06). Everyone is on the Flagsmith Hackathon plan; paid plans say "Coming soon"
 * (billing is not built, no deck limit is enforced).
 */
export const dynamic = "force-dynamic";

export default function DeckPlansPage() {

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        One test has 2 or 3 versions. Boost is not on sale yet.
      </p>

      <DecksLeftCard />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Plan
          name="Flagsmith Hackathon"
          price="Rs 0"
          unit="1,000 tests"
          perks={["1,000 free tests", "Everything in 100 tests", "For Flagsmith Hackathon teams"]}
          current
        />
        <Plan name="Free" price="Rs 0" perks={["1 live test", "Personal link only"]} soon />
        <Plan
          name="10 tests"
          price="Rs 200"
          unit="Rs 20 a test"
          perks={["Listed in the swipe feed", "Free audience targeting", "AI drafting and AI preview"]}
          soon
        />
        <Plan
          name="100 tests"
          price="Rs 1,600"
          unit="Rs 16 a test"
          perks={["Everything in 10 tests", "For founders testing many ideas or products"]}
          badge="Save 20%"
          soon
        />
      </div>

      <p className="text-sm text-muted-foreground">Paid plans are coming soon; prices are placeholders.</p>
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
  soon,
}: {
  name: string;
  price: string;
  unit?: string;
  perks: string[];
  current?: boolean;
  badge?: string;
  /** Not available yet (billing is not built): shows "Coming soon" instead of a buy button. */
  soon?: boolean;
}) {
  return (
    <Card className={cn("flex flex-col p-5", current && "border-accent")}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight"><IconLabel icon="plan">{name}</IconLabel></h2>
        {current ? <span className="shrink-0 rounded-md bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">Current plan</span> : null}
        {badge ? <span className="shrink-0 rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">{badge}</span> : null}
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
      {soon ? (
        <Button variant="outline" className="mt-auto w-full md:w-fit" disabled type="button">
          <Icon icon="statusSoon" /> Coming soon
        </Button>
      ) : null}
    </Card>
  );
}
