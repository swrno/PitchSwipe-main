import { Gift, User } from "lucide-react";
import { safeImageSrc } from "@/lib/decks/image";
import type { Accent } from "@/lib/decks/product";
import type { PreviewCard } from "@/lib/decks/wizard";
import { cn } from "@/lib/utils";
import { ProductTile } from "./ui";

/**
 * Live preview of the swipe card (web design 07, "Live preview · Version B").
 * Shows the founder's real input; empty fields show placeholders so the layout is visible.
 */
export function CardPreview({
  card,
  productName,
  category,
  icon,
  accent,
  madeFor,
  founderLine,
}: {
  card: PreviewCard;
  productName: string;
  category: string;
  icon: string;
  accent: Accent;
  madeFor: string[];
  founderLine?: string;
}) {
  const shots = Array.from({ length: 3 }, (_, i) => safeImageSrc(card.productUI[i]));
  const logoSrc = safeImageSrc(card.logo?.src);
  return (
    <div className="mx-auto w-full max-w-[19rem] rounded-[2.25rem] border-[6px] border-foreground bg-background p-4 shadow-sm" aria-label="Card preview">
      <div className="flex items-center gap-3">
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoSrc} alt={card.logo?.name ?? ""} className="size-11 rounded-xl object-cover" />
        ) : (
          <ProductTile icon={icon} accent={accent} className="size-11 text-lg" />
        )}
        <div className="min-w-0">
          <p className="truncate font-extrabold leading-tight">{productName}</p>
          <p className="truncate text-xs text-muted-foreground">{category}</p>
        </div>
      </div>
      {founderLine ? <p className="mt-2 text-xs text-muted-foreground">{founderLine}</p> : null}

      <h3 className={cn("accent-underline mt-4 inline text-2xl leading-tight", !card.headline && "text-muted-foreground")}>
        {card.headline || "Your headline"}
      </h3>
      <p className={cn("mt-3 text-sm leading-snug", card.description ? "text-muted-foreground" : "text-border")}>
        {card.description || "Your description appears here."}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2" aria-hidden>
        {shots.map((src, i) =>
          src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt="" className="h-24 w-full rounded-lg object-cover" />
          ) : (
            <span key={i} className={cn("h-24 rounded-lg", i === 0 ? "bg-accent" : "bg-muted")} />
          ),
        )}
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="size-3.5 text-accent" />
          <span>
            Made for
            <span className="block font-bold text-foreground">{madeFor.join(", ") || "Everyone"}</span>
          </span>
        </p>
        <p className="text-2xl font-extrabold tracking-tight">{card.price || "Rs —"}</p>
      </div>

      <p className="mt-3 text-center text-sm font-semibold">{card.question || "Your swipe question"}</p>
      <p className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>← {card.negativeLabel || "No"}</span>
        <span>{card.positiveLabel || "Yes"} →</span>
      </p>

      <div className="mt-3 flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground">
        <Gift className="size-4" />
        <span className="truncate">{card.reward || "Your launch reward"}</span>
      </div>
    </div>
  );
}
