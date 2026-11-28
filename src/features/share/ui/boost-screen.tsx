"use client";

import * as React from "react";
import Link from "next/link";
import { Settings, Zap } from "lucide-react";
import { Button, buttonVariants } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { ApiError, api } from "@/features/decks/ui/api";
import { useDeckAndProduct, type BoostData } from "./use-deck-and-product";
import { ChipPicker } from "@/features/decks/ui/chip-picker";
import { Notice, Segmented } from "@/features/decks/ui/primitives";
import { INDUSTRIES, STATES } from "@/shared/lib/lists";
import {
  BOOST_OPTIONS,
  BOOST_PRICE_PER_SWIPE_RS,
  BOOST_SWIPER_SHARE_RS,
  DEFAULT_BOOST_RS,
  boostButtonLabel,
} from "@/features/share/boost";
import { describeAudience, reachView } from "@/features/share/reach";
import { cn } from "@/shared/lib/utils";

/** F6 Audience and Boost (phone 13, web 15). Audience lives on the product; Boost is static (Pitch only). */
export function BoostScreen({ deckId }: { deckId: string }) {
  const { data, loadError } = useDeckAndProduct(deckId);
  if (loadError) return <Notice tone="error">{loadError}</Notice>;
  if (!data) return <p className="text-muted-foreground">Loading...</p>;
  return <Loaded data={data} />;
}

function Loaded({ data }: { data: BoostData }) {
  const { product } = data;
  const [saved, setSaved] = React.useState(product.audience);
  const [draft, setDraft] = React.useState(product.audience);
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: "error" | "ok"; text: string }>();
  const [amount, setAmount] = React.useState<number>(DEFAULT_BOOST_RS);

  const targets = product.targetUsers;
  const reach = reachView();
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);
  const parts = describeAudience(saved, targets);

  async function saveAudience() {
    setSaving(true);
    setMessage(undefined);
    try {
      await api(`/api/products/${product.id}`, {
        method: "PUT",
        body: {
          name: product.name,
          icon: product.icon,
          category: product.category,
          industry: product.industry,
          showOwnerName: product.showOwnerName,
          targetUsers: product.targetUsers,
          audience: draft,
        },
      });
      setSaved(draft);
      setEditing(false);
      setMessage({ tone: "ok", text: "Audience saved. It applies to new decks; running decks keep theirs." });
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof ApiError ? e.message : "Could not save. Try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,23.5rem)] md:items-start">
        <Card className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-lg font-extrabold">
              Who sees it{" "}
              <span className="text-sm font-medium text-muted-foreground">
                · <span className="md:hidden">from</span>
                <span className="hidden md:inline">set on</span> the product
              </span>
            </h2>
            <Link href={`/products/${product.id}/settings`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0 max-md:h-auto max-md:border-0 max-md:bg-transparent max-md:px-0 max-md:underline max-md:underline-offset-2")}>
              <Settings className="hidden md:block" /> Edit product
            </Link>
          </div>
          <p className="text-base leading-relaxed text-muted-foreground">
            <Bold>{parts.roles.join(", ")}</Bold> in <Bold>{parts.states.join(", ")}</Bold> who follow{" "}
            <Bold>{parts.interests.join(", ")}</Bold>.
          </p>
          <p className="text-sm text-muted-foreground">
            {reach.message} · Free · Every deck of {product.name} uses this audience.
          </p>
          <button
            type="button"
            aria-expanded={editing}
            onClick={() => setEditing((v) => !v)}
            className="text-sm font-bold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {editing ? "Close" : "Adjust audience"}
          </button>

          {editing ? (
            <div className="space-y-4 border-t border-border pt-4">
              <div>
                <p className="mb-1.5 text-sm font-bold">Who sees it</p>
                <Segmented
                  label="Who sees it"
                  value={draft.who}
                  onChange={(who) => setDraft((d) => ({ ...d, who }))}
                  options={[
                    { value: "everyone", label: "Everyone" },
                    { value: "targetOnly", label: "Target users only" },
                  ]}
                />
                {draft.who === "targetOnly" && targets.length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">Pick target users in Edit product first.</p>
                ) : null}
              </div>
              <div>
                <p className="mb-1.5 text-sm font-bold">
                  States <span className="font-normal text-muted-foreground">none = all of India</span>
                </p>
                <ChipPicker
                  label="States"
                  options={STATES}
                  selected={[...draft.states]}
                  onChange={(states) => setDraft((d) => ({ ...d, states }))}
                />
              </div>
              <div>
                <p className="mb-1.5 text-sm font-bold">
                  Interests <span className="font-normal text-muted-foreground">none = any</span>
                </p>
                <ChipPicker
                  label="Interests"
                  options={INDUSTRIES}
                  selected={[...draft.interests]}
                  onChange={(interests) => setDraft((d) => ({ ...d, interests }))}
                />
              </div>
              <div aria-live="polite" className="rounded-xl bg-muted p-3 text-sm">
                <p className="text-muted-foreground">{reach.message}</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={saveAudience} disabled={!dirty || saving}>
                  {saving ? "Saving..." : "Save audience"}
                </Button>
                <Button variant="outline" onClick={() => setDraft(saved)} disabled={!dirty || saving}>
                  Reset
                </Button>
              </div>
            </div>
          ) : null}
        </Card>

        <div className="space-y-5">
          <section aria-labelledby="boost-title" className="rounded-xl space-y-4 bg-card border border-border neutral-ink p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 id="boost-title" className="flex items-center gap-2 text-xl">
                <Zap className="size-5 fill-current" /> Boost: priority in the feed
              </h2>
              <span className="hidden text-sm font-semibold text-muted-foreground md:block">Optional</span>
            </div>
            <p className="text-base text-muted-foreground">
              <span className="md:hidden">Optional. </span>A higher chance of being shown to your audience. Rs {BOOST_PRICE_PER_SWIPE_RS} per valid
              swipe; the swiper gets Rs {BOOST_SWIPER_SHARE_RS.toFixed(2)}
              <span className="hidden md:inline"> of it</span>.
            </p>
            <div role="radiogroup" aria-label="Boost budget" className="grid grid-cols-3 gap-2">
              {BOOST_OPTIONS.map((o) => (
                <button
                  key={o.amountRs}
                  type="button"
                  role="radio"
                  aria-checked={amount === o.amountRs}
                  onClick={() => setAmount(o.amountRs)}
                  className={cn(
                    "pressable rounded-2xl border-2 px-2 py-3 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink",
                    amount === o.amountRs ? "border-ink bg-ink text-ink-foreground" : "border-ink/40 text-ink",
                  )}
                >
                  <span className="block text-lg font-extrabold">{o.label}</span>
                  <span className={cn("block text-sm", amount === o.amountRs ? "text-ink-foreground/70" : "text-muted-foreground")}>
                    {o.swipesLabel}
                  </span>
                </button>
              ))}
            </div>
            <Button variant="ink" size="lg" className="w-full" disabled aria-describedby="boost-soon">
              <Zap className="fill-current" /> {boostButtonLabel(amount)}
            </Button>
            <p id="boost-soon" className="text-xs text-muted-foreground">
              Coming soon. No payment is taken and your deck is not boosted.
            </p>
            
          </section>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">Prices are placeholders.</p>
    </div>
  );
}

function Bold({ children }: { children: React.ReactNode }) {
  return <strong className="font-extrabold text-foreground">{children}</strong>;
}
