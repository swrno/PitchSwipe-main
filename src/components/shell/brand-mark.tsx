import { Mascot } from "@/components/ui/mascot";
import { cn } from "@/lib/utils";

/**
 * PitchSwipe logo: the card character (cream card with a face, sky card behind). The same drawing as the mascot,
 * cropped tight. scripts/brand/mark.mjs writes the same drawing to public/icons/*.svg, and scripts/make-icons.mjs
 * renders the PNG icons from those.
 */
export function BrandMark({ className }: { className?: string }) {
  return <Mascot tight color="var(--cream)" back="var(--sky)" className={cn("size-8", className)} />;
}
