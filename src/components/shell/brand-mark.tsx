import { Mascot } from "@/components/ui/mascot";
import { cn } from "@/lib/utils";

/**
 * PitchSwipe logo: the card character (cream card with a face, sky card behind). The same drawing as the mascot,
 * cropped tight. App icons and the favicon are rendered from it by scripts/brand/render-icons.mjs.
 */
export function BrandMark({ className }: { className?: string }) {
  return <Mascot tight color="var(--cream)" back="var(--sky)" className={cn("size-8", className)} />;
}
