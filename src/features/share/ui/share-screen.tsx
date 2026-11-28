"use client";

import { IconLabel } from "@/shared/ui/icon";
import * as React from "react";
import { Check, Copy, Link2, MessageSquare, QrCode as QrIcon } from "lucide-react";
import { Button, buttonVariants } from "@/shared/ui/button";
import { Notice } from "@/features/decks/ui/primitives";
import { deckLink, displayLink, linkedinShareUrl, linkedinText, whatsappShareUrl, whatsappText } from "@/features/share/links";
import { cn } from "@/shared/lib/utils";
import { QrCode } from "./qr-code";
import { useDeckAndProduct, type BoostData } from "./use-deck-and-product";
import { ShareSkeleton } from "@/shared/ui/page-skeletons";

/** Share tab: the test's personal link, WhatsApp, LinkedIn, and its QR code (always visible). */
export function ShareScreen({ deckId, origin }: { deckId: string; origin: string }) {
  const { data, loadError } = useDeckAndProduct(deckId);
  if (loadError) return <Notice tone="error">{loadError}</Notice>;
  if (!data)
    return (
      <ShareSkeleton />
    );
  return <Loaded data={data} origin={origin} />;
}

function Loaded({ data, origin }: { data: BoostData; origin: string }) {
  const { deck, product } = data;
  const [message, setMessage] = React.useState<string>();
  const [copied, setCopied] = React.useState<"link" | "linkedin">();

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
      setMessage("Could not copy. Select the text and copy it by hand.");
    }
  };

  return (
    <div className="space-y-6">
      {message ? <Notice tone="error">{message}</Notice> : null}
          <section
            aria-labelledby="link-title"
            className="grid gap-5 rounded-xl border border-border bg-card p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start"
          >
          <div className="min-w-0 space-y-3">
            <div>
              <h2 id="link-title" className="text-lg font-semibold tracking-tight">
                <IconLabel icon={Link2}>Your personal link</IconLabel>
              </h2>
              <p className="text-sm text-muted-foreground">
                Opens the feed with your test first. Swipes from it are tagged &quot;Your link&quot;.
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
            </div>
            <p className="text-sm text-muted-foreground">
              LinkedIn copies the post text. Paste it into your post.
            </p>
          </div>
          {/* Always visible: scan it from a screen, or print it for a stall or an event. */}
          <figure className="flex flex-col items-center gap-2 rounded-xl bg-muted p-4 md:w-52">
            <QrCode value={url} label={`QR code for ${displayLink(url)}`} className="size-40 shrink-0 rounded-lg bg-white p-2" />
            <figcaption className="text-center text-xs text-muted-foreground">
              <IconLabel icon={QrIcon}>Scan to open your link</IconLabel>
            </figcaption>
          </figure>
          </section>
    </div>
  );
}
