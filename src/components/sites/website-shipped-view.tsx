"use client";

import * as React from "react";
import Link from "next/link";
import { AudioLines, Loader2 } from "lucide-react";

import { assistantJson, deckApi } from "@/components/assistant/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { WebsiteShippedData } from "@/lib/sites/types";
import { cn } from "@/lib/utils";

const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const clockSeconds = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/**
 * F9c Website shipped, before / after (web 22). Shown on the deck's results page once shipped.
 * Undo calls the WP8 undo endpoint (the control card is served again there; the completed experiment does not
 * restart); this view only reads.
 */
export function WebsiteShippedView({
  deckId,
  initial,
  onChanged,
  hideCrumb = false,
}: {
  deckId: string;
  /** Hide the "Decks / Product / Test" line when the page header (deck chrome) already shows it. */
  hideCrumb?: boolean;
  initial?: WebsiteShippedData;
  /** Called after Undo, so the page can refresh its status. */
  onChanged?: () => void;
}) {
  const [data, setData] = React.useState<WebsiteShippedData | null>(initial ?? null);
  const [error, setError] = React.useState<string | null>(null);
  const [undoing, setUndoing] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setData(await assistantJson<WebsiteShippedData>("GET", `/api/sites/shipped?deckId=${encodeURIComponent(deckId)}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [deckId]);

  React.useEffect(() => {
    if (!initial) {
      // Loads on mount; setState happens after the awaited fetch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void load();
    }
  }, [initial, load]);

  async function undo() {
    setUndoing(true);
    setError(null);
    try {
      await assistantJson("POST", `${deckApi(deckId)}/undo`);
      await load();
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUndoing(false);
    }
  }

  if (!data) {
    return error ? (
      <p role="alert" className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
        {error}
      </p>
    ) : (
      <p className="text-sm text-muted-foreground" role="status">
        Loading your website view...
      </p>
    );
  }

  const name = `${data.noun} ${data.afterKey}`;
  const live = data.live;
  const site = data.domain ?? "your website";

  return (
    <section aria-label="Website before and after" className="pb-6">
      <p className={cn("mb-3 hidden text-sm text-muted-foreground", !hideCrumb && "md:block")}>
        Decks / {data.productName} / {data.noun} test
      </p>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl">
          {live ? (
            <>
              {name} is live on <span className="underline decoration-accent decoration-4 underline-offset-4">your website</span>.
            </>
          ) : (
            <>Switched back to {data.noun} {data.beforeKey} on your website.</>
          )}
        </h2>
        {live ? (
          <Button variant="outline" onClick={undo} disabled={undoing}>
            {undoing ? <Loader2 className="animate-spin" /> : null} Undo: switch back
          </Button>
        ) : null}
      </div>
      <p className="mt-3 max-w-3xl text-base text-muted-foreground md:text-lg">
        {live
          ? `The same Flagsmith flag that ran the test now serves ${name} to everyone, on PitchSwipe and on ${site}. Your site picked it up within seconds.`
          : `The flag serves your previous text again. ${site} follows within seconds.`}
      </p>
      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Pane
          title="Before"
          note={`Your current ${data.noun.toLowerCase()} (${data.beforeKey})`}
          data={data}
          text={data.beforeText}
          highlight={false}
        />
        <Pane
          title={live ? "After you approve" : "Shipped, then undone"}
          note={live ? `Updated by PitchSwipe at ${clock(data.shippedAt)} · no deploy` : `${name} was live from ${clock(data.shippedAt)}`}
          noteTone={live ? "good" : "plain"}
          data={data}
          text={data.afterText}
          highlight={live}
        />
      </div>

      <Card className="mt-6 grid gap-5 p-5 md:grid-cols-3 md:p-6">
        <div>
          <h3 className="font-bold">Flag</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="break-all font-mono text-foreground">{data.flagName}</span> {live ? `now serves ${data.afterKey} to 100%.` : `serves ${data.beforeKey} again.`}
          </p>
        </div>
        <div>
          <h3 className="font-bold">Proof it worked</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.proof ? (
              live && data.proof.matchesWinner ? (
                <>Snippet on {site} reported the new value at {clockSeconds(data.proof.seenAt)}.</>
              ) : live ? (
                <>Last report from {site} at {clockSeconds(data.proof.seenAt)} still shows older text. It updates on the next page load.</>
              ) : (
                <>Last report from {site} at {clockSeconds(data.proof.seenAt)}.</>
              )
            ) : data.domain ? (
              <>No report from {site} yet. Open your site once; the proof appears here.</>
            ) : (
              <>
                No website connected.{" "}
                <Link href={data.connectHref} className="font-medium text-foreground underline underline-offset-2">
                  Connect it
                </Link>{" "}
                to see proof here.
              </>
            )}
          </p>
        </div>
        <div>
          <h3 className="font-bold">Next, optional</h3>
          <p className="mt-1 text-sm text-muted-foreground">Run the same flag as a real A/B test on your site to check that the swipe winner also wins there.</p>
        </div>
      </Card>
    </section>
  );
}

function Pane({
  title,
  note,
  noteTone = "plain",
  data,
  text,
  highlight,
}: {
  title: string;
  note: string;
  noteTone?: "plain" | "good";
  data: WebsiteShippedData;
  text: string;
  highlight: boolean;
}) {
  const isHeadline = data.noun === "Headline";
  const shown = (value: string, own: boolean, fallback: string) => (own ? text : value || fallback);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xl font-extrabold tracking-tight">{title}</h3>
        <p className={cn("text-sm font-semibold", noteTone === "good" ? "text-accent" : "text-muted-foreground")}>{note}</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <span className="flex gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-2.5 rounded-full bg-border" />
            ))}
          </span>
          <span className="flex-1 truncate rounded-md bg-muted px-3 py-1 text-xs text-muted-foreground">{data.domain ?? "your-site.com"}</span>
        </div>
        <div className="p-5 md:p-7">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-3 font-bold">
              <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground" aria-hidden>
                <AudioLines className="size-5" />
              </span>
              {data.productName}
            </span>
            <span className="text-xs text-muted-foreground">Pricing · Login</span>
          </div>
          <p
            className={cn(
              "mt-8 rounded-xl text-3xl font-extrabold leading-tight tracking-tight md:text-4xl",
              highlight && "bg-accent-soft p-2 -m-2",
            )}
          >
            {isHeadline ? text : data.context.description || data.productName}
          </p>
          {data.context.description && isHeadline ? <p className="mt-5 text-sm text-muted-foreground md:text-base">{data.context.description}</p> : null}
          {data.context.reward || data.context.price || !isHeadline ? (
            <div className="mt-6 flex flex-wrap items-center gap-4">
              {data.context.reward || data.noun === "Reward" ? (
                <span className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground">{shown(data.context.reward, data.noun === "Reward", "Get started")}</span>
              ) : null}
              {data.context.price || data.noun === "Price" ? (
                <span className={cn("text-sm font-bold", highlight && data.noun === "Price" && "rounded-lg bg-accent-soft px-2 py-1")}>{shown(data.context.price, data.noun === "Price", "")}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
