"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Copy, Link2, MessageSquare, QrCode as QrIcon, Settings, Zap } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, ApiError } from "@/components/decks/api";
import { ChipPicker } from "@/components/decks/chip-picker";
import { Notice, Segmented, SubPageNav } from "@/components/decks/ui";
import { INDUSTRIES, STATES } from "@/lib/lists";
import { deckLabel, type ProductRecord } from "@/lib/decks/views";
import type { DeckRecord } from "@/lib/decks/types";
import {
  BOOST_OPTIONS,
  BOOST_PRICE_PER_SWIPE_RS,
  BOOST_SWIPER_SHARE_RS,
  DEFAULT_BOOST_RS,
  boostButtonLabel,
} from "@/lib/share/boost";
import { deckLink, displayLink, linkedinShareUrl, linkedinText, whatsappShareUrl, whatsappText } from "@/lib/share/links";
import { DemoBadge } from "@/components/ui/demo-badge";
import { describeAudience, reachView } from "@/lib/share/reach";
import { cn } from "@/lib/utils";
import { QrCode } from "./qr-code";

export interface BoostData {
  deck: Pick<DeckRecord, "_id" | "slug" | "variable">;
  product: ProductRecord;
}

/** F6 Audience and Boost (phone 13, web 15). Audience lives on the product; Boost is static (Pitch only). */
export function BoostScreen({ deckId, origin, initial, demo = false }: { deckId: string; origin: string; initial?: BoostData; demo?: boolean }) {
  const [data, setData] = React.useState<BoostData | undefined>(initial);
  const [loadError, setLoadError] = React.useState<string>();

  React.useEffect(() => {
    if (initial) return;
    let cancelled = false;
    api<DeckRecord>(`/api/decks/${deckId}`)
      .then(async (deck) => {
        const product = await api<ProductRecord>(`/api/products/${deck.productId}`);
        if (!cancelled) setData({ deck, product });
      })
      .catch((e: Error) => !cancelled && setLoadError(e.message));
    return () => {
      cancelled = true;
    };
  }, [deckId, initial]);

  if (loadError) return <Notice tone="error">{loadError}</Notice>;
  if (!data) return <p className="text-muted-foreground">Loading...</p>;
  return <Loaded data={data} origin={origin} demo={demo} />;
}

function Loaded({ data, origin, demo }: { data: BoostData; origin: string; demo: boolean }) {
  const { deck, product } = data;
  const [saved, setSaved] = React.useState(product.audience);
  const [draft, setDraft] = React.useState(product.audience);
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: "error" | "ok"; text: string }>();
  const [amount, setAmount] = React.useState<number>(DEFAULT_BOOST_RS);
  const [boostNote, setBoostNote] = React.useState(false);
  const [copied, setCopied] = React.useState<"link" | "linkedin">();
  const [showQr, setShowQr] = React.useState(false);

  const targets = product.targetUsers;
  const savedReach = reachView(demo, saved, targets);
  const draftReach = reachView(demo, draft, targets);
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);
  const parts = describeAudience(saved, targets);

  const url = deckLink(origin, deck.slug);
  const copy = { productName: product.name, tagline: product.category || undefined };
  const waText = whatsappText(copy, url);
  const liText = linkedinText(copy, url);

  const clip = async (text: string, what: "link" | "linkedin") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(undefined), 1800);
    } catch {
      setMessage({ tone: "error", text: "Could not copy. Select the text and copy it by hand." });
    }
  };

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
      <SubPageNav
        backHref={`/decks/${deck._id}`}
        crumbs={`Decks / ${product.name} · ${deckLabel(deck.variable)} test`}
        right={<span className="md:hidden">{product.name}</span>}
      />
      <h1 className="text-4xl md:text-5xl">Audience and Boost</h1>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,23.5rem)] md:items-start">
        <Card className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-extrabold">
              Who sees it{" "}
              <span className="text-sm font-medium text-muted-foreground">
                · <span className="md:hidden">from</span>
                <span className="hidden md:inline">set on</span> the product
              </span>
            </h2>
            <Link href={`/products/${product.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0 max-md:h-auto max-md:border-0 max-md:bg-transparent max-md:px-0 max-md:underline max-md:underline-offset-2")}>
              <Settings className="hidden md:block" /> Edit product
            </Link>
          </div>
          <p className="text-base leading-relaxed text-muted-foreground">
            <Bold>{parts.roles.join(", ")}</Bold> in <Bold>{parts.states.join(", ")}</Bold> who follow{" "}
            <Bold>{parts.interests.join(", ")}</Bold>.
          </p>
          <p className="text-sm text-muted-foreground">
            {savedReach.kind === "estimate" ? (
              <>
                Estimated reach {savedReach.formatted} swipers {savedReach.label ? <DemoBadge className="mx-1" /> : null}
              </>
            ) : (
              savedReach.message
            )}{" "}
            · Free · Every deck of {product.name} uses this audience.
          </p>
          {savedReach.kind === "estimate" && savedReach.estimate.small ? <Notice tone="error">{savedReach.estimate.warning}</Notice> : null}
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
                {draftReach.kind === "estimate" ? (
                  <>
                    <p className="font-bold">
                      Estimated reach {draftReach.formatted} swipers {draftReach.label ? <DemoBadge className="ml-1" /> : null}
                    </p>
                    {draftReach.estimate.small ? (
                      <p className="mt-1 text-warning">{draftReach.estimate.warning}</p>
                    ) : (
                      <p className="mt-1 text-muted-foreground">Enough swipers to reach a result at a normal pace.</p>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">{draftReach.message}</p>
                )}
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
          <section aria-labelledby="boost-title" className="tile space-y-4 bg-sky p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 id="boost-title" className="flex items-center gap-2 text-xl">
                <Zap className="size-5 fill-current" /> Boost: priority in the feed
              </h2>
              <span className="hidden text-sm font-semibold text-ink/65 md:block">Optional</span>
            </div>
            <p className="text-base text-ink/75">
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
                  <span className={cn("block text-sm", amount === o.amountRs ? "text-ink-foreground/70" : "text-ink/65")}>
                    {o.swipesLabel}
                  </span>
                </button>
              ))}
            </div>
            <Button variant="ink" size="lg" className="w-full" onClick={() => setBoostNote(true)}>
              <Zap className="fill-current" /> {boostButtonLabel(amount)}
            </Button>
            {boostNote ? (
              <p role="status" className="text-sm text-ink/70">
                Boost is a preview in this demo. No payment is taken and your deck is not boosted.
              </p>
            ) : null}
          </section>

          <section aria-labelledby="link-title" className="space-y-3 md:rounded-xl md:border md:border-border md:bg-card md:p-5">
            <div>
              <h2 id="link-title" className="text-lg font-extrabold md:text-xl">
                <span className="md:hidden">Or share your personal link</span>
                <span className="hidden md:inline">Your personal link</span>
              </h2>
              <p className="text-muted-foreground">
                Opens the feed with your deck first. After one swipe, the feed goes random.
                <span className="hidden md:inline"> Swipes are tagged as &quot;Your link&quot;.</span>
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2 md:border-0 md:bg-transparent md:p-0">
              <Link2 className="ml-3 size-5 shrink-0 text-accent md:hidden" aria-hidden />
              <input
                readOnly
                aria-label="Your personal link"
                value={displayLink(url)}
                onFocus={(e) => e.currentTarget.select()}
                className="h-12 min-w-0 flex-1 truncate bg-transparent text-base font-medium focus-visible:outline-none md:rounded-xl md:bg-muted md:px-4"
              />
              <Button onClick={() => clip(url, "link")} className="shrink-0">
                {copied === "link" ? <Check /> : <Copy />} {copied === "link" ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
              <a
                href={whatsappShareUrl(waText)}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "outline" }), "md:h-11")}
              >
                <MessageSquare /> WhatsApp
              </a>
              <a
                href={linkedinShareUrl(url)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => clip(liText, "linkedin")}
                className={cn(buttonVariants({ variant: "outline" }), "md:h-11")}
              >
                {copied === "linkedin" ? <Check /> : null} {copied === "linkedin" ? "Post text copied" : "LinkedIn"}
              </a>
              <Button variant="outline" className="hidden md:inline-flex md:h-11" aria-expanded={showQr} onClick={() => setShowQr((v) => !v)}>
                <QrIcon /> QR code
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              WhatsApp opens with a ready message. LinkedIn opens its share page and copies the post text, so paste it into your post.
            </p>
            {showQr ? (
              <div className="hidden items-center gap-4 rounded-xl bg-muted p-4 md:flex">
                <QrCode value={url} label={`QR code for ${displayLink(url)}`} className="size-40 shrink-0 rounded-lg" />
                <p className="text-sm text-muted-foreground">Scan to open {displayLink(url)}. Print it or show it on a screen.</p>
              </div>
            ) : null}
          </section>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">Prices are placeholders for the hackathon demo.</p>
    </div>
  );
}

function Bold({ children }: { children: React.ReactNode }) {
  return <strong className="font-extrabold text-foreground">{children}</strong>;
}
