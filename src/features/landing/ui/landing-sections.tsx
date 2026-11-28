import Link from "next/link";
import { Check, Eye, Flag, Gift, Lock, Shuffle, Sparkles, Users } from "lucide-react";
import { buttonVariants } from "@/shared/ui/button";
import { ArrowChip, Mascot } from "@/shared/ui/mascot";
import { MIN_READ_MS, PAID_RATE_RS } from "@/features/swipe/validity";
import { BOOST_PRICE_PER_SWIPE_RS, BOOST_SWIPER_SHARE_RS } from "@/features/share/boost";
import { cn, formatRs } from "@/shared/lib/utils";
import { ExampleCard } from "./example-card";

const READ_SECONDS = MIN_READ_MS / 1000;

/** Where the founder buttons go: sign up first, then the new-deck page. */
const TEST_AN_IDEA_HREF = "/signup?next=/decks/new";

/** Shared width and gutters: 16px on phones, wider on desktop. */
function Wrap({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 md:px-8", className)}>{children}</div>;
}

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="overflow-hidden">
      <Wrap className="grid items-center gap-10 pb-16 pt-10 md:grid-cols-[1.15fr_1fr] md:gap-12 md:pb-24 md:pt-20">
        <div className="rise-children">
          <span className="inline-flex items-center gap-2 rounded-full bg-ink px-3.5 py-1.5 text-xs font-bold text-ink-foreground ring-1 ring-border">
            <Flag aria-hidden className="size-3.5 text-accent" strokeWidth={2.5} />
            Experiments run on Flagsmith
          </span>
          <h1 id="hero-title" className="mt-5 text-[2.75rem] md:text-7xl">
            Test your pitch.
            <br />
            <span className="accent-underline">Then build.</span>
          </h1>
          <p className="mt-5 max-w-[36ch] text-lg text-muted-foreground md:text-xl">
            Change one thing, like your headline or your launch reward. Real people swipe, and you see which version makes them
            sign up.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href={TEST_AN_IDEA_HREF} className={cn(buttonVariants({ variant: "lime", size: "lg" }), "justify-between gap-4 pl-7 pr-2.5")}>
              Test an idea
              <ArrowChip tone="ink" className="size-9" />
            </Link>
            <Link href="/swipe" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Swipe on ideas
            </Link>
          </div>
        </div>
        <ExampleCard />
      </Wrap>
    </section>
  );
}

const FOUNDER_STEPS = [
  {
    title: "Pick what to test",
    body: "Headline, description, launch reward, price, product UI, logo or language. Everything else stays locked and identical on every card.",
    tone: "bg-muted neutral-ink",
  },
  {
    title: "Ask your question",
    body: 'Like "Would you pay Rs 299 a month?", with your own yes and no answers, plus a launch reward people can claim.',
    tone: "bg-card border border-border neutral-ink",
  },
  {
    title: "Reach real people",
    body: "Your live test shows in the swipe feed, and you get a link to share with your own audience. Paid boosts are planned.",
    tone: "bg-card border border-border neutral-ink",
  },
];

export function Founders() {
  return (
    <section id="founders" aria-labelledby="founders-title" className="scroll-mt-20 py-16 md:py-24">
      <Wrap>
        <h2 id="founders-title" data-reveal className="text-3xl md:text-5xl">
          For founders: change one thing.
          <br />
          <span className="text-muted-foreground">Find out what works.</span>
        </h2>
        <ol className="mt-8 grid gap-3 md:mt-10 md:grid-cols-3 md:gap-4">
          {FOUNDER_STEPS.map((s, i) => (
            <li
              key={s.title}
              data-reveal
              style={{ "--i": i } as React.CSSProperties}
              className={cn("tile flex flex-col p-6 transition-[translate] duration-300 hover:-translate-y-1.5 md:min-h-64 md:p-7", s.tone)}
            >
              <span aria-hidden className="stretch-display tnum text-6xl font-bold leading-none md:text-7xl">
                {i + 1}
              </span>
              <h3 className="mt-6 text-2xl md:mt-auto md:pt-8">
                <span className="sr-only">Step {i + 1}: </span>
                {s.title}
              </h3>
              <p className="mt-2 text-sm font-medium text-ink/75 md:text-base">{s.body}</p>
            </li>
          ))}
        </ol>
      </Wrap>
    </section>
  );
}

const HOW_IT_WORKS = [
  {
    icon: Sparkles,
    title: "Two to three versions",
    body: "You write 2 to 3 versions of one idea. Only the one thing you chose differs between them.",
    tone: "bg-muted neutral-ink",
  },
  {
    icon: Shuffle,
    title: "One card per swiper",
    body: "Flagsmith randomly assigns each swiper exactly one version. They never see the others, so there is no order bias.",
    tone: "bg-card border border-border neutral-ink",
  },
  {
    icon: Gift,
    title: "Reward claims are the result",
    body: "A positive answer offers your launch reward in exchange for an email. The version that earns the most claims wins.",
    tone: "bg-card border border-border neutral-ink",
  },
  {
    icon: Users,
    title: "Your waitlist",
    body: "Every claim joins one waitlist. Flagsmith calls a winner only with at least 50 people per card and a 95% chance to beat the control. You approve before anything ships.",
    tone: "bg-card border border-border neutral-ink",
  },
];

export function HowItWorks() {
  return (
    <section aria-labelledby="how-title" className="pb-16 md:pb-24">
      <Wrap>
        <h2 id="how-title" data-reveal className="text-3xl md:text-5xl">
          How the test works.
        </h2>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 md:mt-10 lg:grid-cols-4 lg:gap-4">
          {HOW_IT_WORKS.map(({ icon: Icon, title, body, tone }, i) => (
            <li
              key={title}
              data-reveal
              style={{ "--i": i } as React.CSSProperties}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-[translate,border-color] duration-300 hover:-translate-y-1.5 hover:border-muted-foreground/40 md:p-6"
            >
              <span aria-hidden className={cn("flex size-11 items-center justify-center rounded-2xl text-ink", tone)}>
                <Icon className="size-5" strokeWidth={2.5} />
              </span>
              <h3 className="text-lg">{title}</h3>
              <p className="text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </Wrap>
    </section>
  );
}

export function Swipers() {
  const points = [
    {
      icon: Eye,
      title: "Honest answers only",
      body: "You earn the same for a yes or a no. Only reading time counts.",
    },
    {
      icon: Gift,
      title: "Early rewards",
      body: "Like an idea? Claim the founder's launch reward, like free months or credit.",
    },
  ];
  return (
    <section id="swipers" aria-labelledby="swipers-title" className="scroll-mt-20 pb-16 md:pb-24">
      <Wrap>
        <div data-reveal className="tile relative overflow-hidden bg-card border border-border neutral-ink p-6 md:p-12">
          <Mascot
            mood="happy"
            color="var(--cream)"
            back="var(--accent)"
            className="float absolute -right-3 -top-2 size-24 rotate-6 md:right-8 md:top-8 md:size-40"
          />
          <span className="inline-flex rounded-full bg-ink px-3 py-1 text-xs font-bold text-ink-foreground">For swipers</span>
          <h2 id="swipers-title" className="mt-4 max-w-[13ch] pr-16 text-4xl md:max-w-none md:pr-48 md:text-6xl">
            See new ideas first.
          </h2>
          <p className="mt-4 max-w-[46ch] text-base font-medium text-ink/80 md:text-lg">
            Swipe through ideas before they launch, answer one honest question per card, and claim early rewards from the
            founders you like.
          </p>

          <div className="mt-8 grid gap-3 md:grid-cols-[1.2fr_1fr_1fr] md:gap-4">
            <div className="rounded-xl bg-ink p-5 text-ink-foreground md:p-6">
              <p className="stretch-display tnum text-4xl font-bold text-accent md:text-5xl">{formatRs(PAID_RATE_RS)}</p>
              <p className="mt-1 font-bold">per valid swipe on paid cards</p>
              <p className="mt-2 text-sm text-ink-foreground/70">
                Paid cards are clearly marked. A swipe is valid when you read the card for at least {READ_SECONDS} seconds. Yes and no
                pay the same.
              </p>
              <p className="mt-4 inline-flex rounded-full border border-dashed border-ink-foreground/40 px-3 py-1 text-xs font-bold">
                Payouts are not live yet
              </p>
            </div>
            {points.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-xl bg-card neutral-ink/90 p-5 md:p-6">
                <Icon aria-hidden className="size-6" strokeWidth={2.5} />
                <h3 className="mt-3 text-xl">{title}</h3>
                <p className="mt-1 text-sm text-ink/70">{body}</p>
              </div>
            ))}
          </div>

          <Link href="/swipe" className={cn(buttonVariants({ variant: "ink", size: "lg" }), "mt-8 w-full justify-between pl-7 pr-2.5 sm:w-auto sm:gap-6")}>
            Swipe on ideas
            <ArrowChip className="size-9" />
          </Link>
        </div>
      </Wrap>
    </section>
  );
}

const PAID_PLANS = [
  {
    name: "Test pack",
    price: "Rs 200",
    unit: "10 tests, Rs 20 each",
    perks: ["All results and reward claims", "AI drafting and card checker"],
  },
  {
    name: "Big pack",
    price: "Rs 1,600",
    unit: "100 tests, Rs 16 each (save 20%)",
    perks: ["All results and reward claims", "AI drafting and card checker"],
  },
  {
    name: "Boost",
    price: `Rs ${BOOST_PRICE_PER_SWIPE_RS}`,
    unit: "Per valid swipe",
    perks: ["Higher chance to be shown in the feed", `Swipers get ${formatRs(BOOST_SWIPER_SHARE_RS)} of it`, "Set your own budget"],
  },
];

/*
 * What Free gives today, and nothing more: publish() in src/features/decks/server/service.ts lists every live deck in the swipe
 * feed, every deck gets a share link (/d/<slug>), and no deck limit is enforced yet (see /decks/plans).
 */
const FREE_PERKS = ["Your live test shows in the swipe feed", "A share link for your own audience", "No test limit during the pilot"];

export function Pricing() {
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-20 pb-16 md:pb-24">
      <Wrap>
        <h2 id="pricing-title" data-reveal className="text-3xl md:text-5xl">
          Simple pricing.
        </h2>
        <p className="mt-3 max-w-[52ch] text-muted-foreground">
          Free while we pilot. Paid plans are planned and shown so you know where this is going; nothing can be bought yet,
          and their limits and perks may change.
        </p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 md:mt-10 lg:grid-cols-4 lg:gap-4">
          <li data-reveal className="tile flex flex-col border border-border bg-card neutral-ink p-6 transition-[translate] duration-300 hover:-translate-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xl">Free</h3>
              <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-ink-foreground">Available now</span>
            </div>
            <p className="stretch-display tnum mt-4 text-5xl font-bold">Rs 0</p>
            <p className="mt-1 text-sm font-semibold text-ink/70">Free while we pilot</p>
            <ul className="mt-5 space-y-2 text-sm font-semibold">
              {FREE_PERKS.map((perk) => (
                <li key={perk} className="flex gap-2">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={3} />
                  {perk}
                </li>
              ))}
            </ul>
            <Link href={TEST_AN_IDEA_HREF} className={cn(buttonVariants({ variant: "ink" }), "mt-6 justify-between pl-6 pr-2 lg:mt-auto")}>
              Start free
              <ArrowChip />
            </Link>
          </li>
          {PAID_PLANS.map((plan, i) => (
            <li
              key={plan.name}
              data-reveal
              style={{ "--i": i + 1 } as React.CSSProperties}
              className="flex flex-col rounded-xl border border-border bg-card p-6"
            >
              <span className="inline-flex w-fit items-start gap-1.5 rounded-xl border border-dashed border-border bg-muted px-2.5 py-1 text-xs font-semibold leading-snug text-muted-foreground">
                <Lock aria-hidden className="mt-px size-3 shrink-0" />
                Planned pricing, not available yet
              </span>
              <h3 className="mt-4 text-xl">{plan.name}</h3>
              <p className="stretch-display tnum mt-3 text-5xl font-bold text-muted-foreground">{plan.price}</p>
              <p className="mt-1 text-sm text-muted-foreground">{plan.unit}</p>
              <ul className="mt-5 space-y-2 text-sm">
                {plan.perks.map((perk) => (
                  <li key={perk} className="flex gap-2">
                    <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={3} />
                    {perk}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Wrap>
    </section>
  );
}

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="pb-16 md:pb-24">
      <Wrap>
        <div data-reveal className="tile relative overflow-hidden bg-lime p-6 md:p-14">
          <Mascot
            mood="wow"
            color="var(--cream)"
            back="var(--accent)"
            className="float absolute -right-3 -top-2 size-24 rotate-6 [--float-delay:-2s] md:bottom-6 md:right-10 md:top-auto md:size-48 md:-rotate-6"
          />
          <h2 id="cta-title" className="max-w-[14ch] pr-16 text-4xl md:pr-0 md:text-6xl">
            Test your pitch before you build.
          </h2>
          <p className="mt-4 max-w-[40ch] font-medium text-ink/75 md:text-lg">
            Make a test in minutes, share the link, and see which version makes people sign up.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row md:pr-56">
            <Link href={TEST_AN_IDEA_HREF} className={cn(buttonVariants({ variant: "ink", size: "lg" }), "justify-between gap-4 pl-7 pr-2.5")}>
              Test an idea
              <ArrowChip className="size-9" />
            </Link>
            <Link
              href="/swipe"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "border-ink/80 bg-lime text-ink hover:bg-ink/10")}
            >
              Swipe on ideas
            </Link>
          </div>
        </div>
      </Wrap>
    </section>
  );
}
