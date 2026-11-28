import * as React from "react";
import { AudioLines, Gift, MessageSquarePlus, Truck, User } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { safeImageSrc } from "@/features/decks/image";
import type { Accent, CardView } from "@/features/swipe/types";

/** Card accent follows the product (designs: green / blue / purple). */
export const ACCENT_VAR: Record<Accent, string> = {
  green: "var(--accent)",
  blue: "var(--accent)",
  purple: "var(--accent)",
};

const GLYPHS: Record<string, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  "audio-lines": AudioLines,
  clinic: MessageSquarePlus,
  truck: Truck,
};

/** Devanagari (Hindi) needs looser leading than the tight Latin headline style, for the matras. */
export function isDevanagari(lang: string): boolean {
  return ["hi", "mr", "ne"].includes(lang.slice(0, 2).toLowerCase());
}

/**
 * Style for translated headline text: Anek Devanagari (the same family as the Latin text, loaded in the root
 * layout), normal width, no negative tracking, room for the matras.
 */
export function scriptStyle(lang: string): React.CSSProperties | undefined {
  return isDevanagari(lang)
    ? { fontFamily: '"Anek Devanagari", "Anek Latin", system-ui, sans-serif', fontStretch: "100%", letterSpacing: 0, lineHeight: 1.35 }
    : undefined;
}

/**
 * Kept for its callers. Anek Devanagari now comes with the root stylesheet and downloads only when Devanagari
 * text is on screen (unicode-range), so there is nothing extra to load per card.
 */
export function LangFont(props: { lang: string }) {
  void props;
  return null;
}

/** The product tile: an uploaded logo, or the product's letter. */
export function ProductTile({ card, className }: { card: CardView; className?: string }) {
  const Glyph = GLYPHS[card.product.icon];
  return (
    <div
      className={cn(
        "flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-2xl font-extrabold text-accent-foreground md:size-14 md:rounded-xl",
        className,
      )}
      style={{ backgroundColor: ACCENT_VAR[card.product.accent] }}
    >
      {card.logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- founder-uploaded data URLs and logos
        <img src={safeImageSrc(card.logo.src)} alt={card.logo.name} className="size-full object-cover" />
      ) : Glyph ? (
        <Glyph aria-hidden className="size-8 md:size-7" />
      ) : (
        <span aria-hidden>{card.product.icon}</span>
      )}
    </div>
  );
}

/**
 * The pitch card (designs phone 34/35/39/40, web 33). Renders whatever the one assigned card says,
 * including the whole translated card of the Language test (`lang` sets the text language).
 */
export function DeckCard({
  card,
  className,
  onReward,
  rewardLocked = false,
}: {
  card: CardView;
  className?: string;
  /** Makes the reward a button: tapping it answers yes and opens the claim. Without it the reward is display only. */
  onReward?: () => void;
  /** True during the 2 s read lock (and while saving), like the answer buttons. */
  rewardLocked?: boolean;
}) {
  const accent = ACCENT_VAR[card.product.accent];
  const [line1, line2] = card.headlineLines;

  return (
    <article
      lang={card.lang}
      aria-label={`${card.product.name} pitch`}
      className={cn(
        "relative rounded-3xl border border-border bg-card p-5 text-card-foreground shadow-[0_8px_30px_rgba(0,0,0,0.06)] md:p-8",
        className,
      )}
    >
      <header className="flex items-center gap-3.5 md:gap-4">
        <ProductTile card={card} />
        <div className="min-w-0" lang="en">
          <p className="truncate text-xl font-extrabold leading-tight tracking-tight md:text-xl">{card.product.name}</p>
          <p className="truncate text-sm text-muted-foreground">{card.product.category}</p>
        </div>
      </header>

      <h2 style={scriptStyle(card.lang)} className="mt-3 text-[1.75rem] font-extrabold leading-[1.08] tracking-[-0.035em] md:mt-6 md:text-[2.1rem]">
        {line2 ? <span className="block">{line1}</span> : null}
        <span
          className="inline-block pb-1"
          style={{
            backgroundImage: `linear-gradient(${accent}, ${accent})`,
            backgroundRepeat: "no-repeat",
            backgroundSize: "100% 4px",
            backgroundPosition: "0 100%",
          }}
        >
          {line2 ?? line1}
        </span>
      </h2>

      {card.description ? (
        <p style={scriptStyle(card.lang)} className="mt-3 text-base leading-snug text-muted-foreground md:mt-4 md:text-base md:leading-relaxed">
          {card.description}
        </p>
      ) : null}

      <div className="md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-x-3">
      {card.madeFor.length > 0 ? (
        <p className="mt-2.5 flex items-center gap-2 text-sm md:order-2 md:mt-5 md:self-end" lang="en">
          <User aria-hidden className="size-4 shrink-0" style={{ color: accent }} />
          <span className="whitespace-nowrap text-muted-foreground">Made for</span>
          <span className="min-w-0 truncate font-bold">{card.madeFor.join(", ")}</span>
        </p>
      ) : null}

      {/* Phone: three fixed 82 x 120 thumbnails as in design phone 34 keep the card inside the first viewport. */}
      {card.screens.length > 0 ? (
        <div className="mt-3 grid grid-cols-[repeat(3,5.125rem)] gap-1.5 md:order-1 md:col-span-full md:grid-cols-3 md:gap-3" aria-label="Product screens">
          {card.screens.slice(0, 3).map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- founder-uploaded data URLs
            <img
              key={i}
              src={safeImageSrc(src)}
              alt={`${card.product.name} screen ${i + 1}`}
              className="aspect-[164/232] w-full md:aspect-[164/240] rounded-xl border border-border object-cover"
            />
          ))}
        </div>
      ) : null}

      {card.price ? (
        <p className="mt-2 text-right md:order-3 md:col-start-2 md:mt-0">
          <span className="stretch-display tnum text-3xl font-extrabold tracking-tight">{card.price.amount}</span>
          {card.price.unit ? <span className="ml-2 text-sm text-muted-foreground">{card.price.unit}</span> : null}
        </p>
      ) : null}
      </div>

      {card.reward && onReward ? (
        <button
          type="button"
          disabled={rewardLocked}
          onClick={onReward}
          // A tap on the reward must not start a card drag.
          onPointerDownCapture={(e) => e.stopPropagation()}
          aria-label={`Yes, claim: ${card.reward}`}
          className={cn(
            "mt-3 flex h-11 w-full md:mt-6 md:h-12 items-center justify-center gap-3 rounded-xl bg-primary px-4 text-base font-bold text-primary-foreground outline-none transition-[opacity,transform] duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 enabled:cursor-pointer enabled:active:scale-[0.98] disabled:cursor-not-allowed md:text-base",
            rewardLocked && "opacity-60",
          )}
        >
          <Gift aria-hidden className="size-4 shrink-0" />
          <span className="min-w-0 text-center leading-tight">{card.reward}</span>
        </button>
      ) : card.reward ? (
        <div className="mt-3 flex h-11 md:mt-6 md:h-12 items-center justify-center gap-3 rounded-xl bg-primary px-4 text-base font-bold text-primary-foreground md:text-base">
          <Gift aria-hidden className="size-4 shrink-0" />
          <span className="min-w-0 text-center leading-tight">{card.reward}</span>
        </div>
      ) : null}
    </article>
  );
}
