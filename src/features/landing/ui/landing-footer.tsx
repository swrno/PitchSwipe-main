import Link from "next/link";
import { BrandMark } from "@/shared/shell/brand-mark";

const PRODUCT_LINKS = [
  { href: "#founders", label: "For founders" },
  { href: "#swipers", label: "For swipers" },
  { href: "#pricing", label: "Pricing" },
];
const LEGAL_LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/contact", label: "Contact" },
];

const linkClass =
  "rounded-sm text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function LandingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 md:flex-row md:items-start md:justify-between md:px-8">
        <div>
          <Link href="/" aria-label="PitchSwipe home" className="inline-flex items-center gap-1.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <BrandMark className="size-8" />
            <span className="font-display text-lg font-bold tracking-tight">PitchSwipe</span>
          </Link>
          <p className="mt-2 max-w-[32ch] text-sm text-muted-foreground">Test your pitch. Then build.</p>
          <p className="mt-4 text-xs font-semibold text-muted-foreground">Built for the Flagsmith Toggle Wars hackathon</p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:gap-16">
          <nav aria-label="Product">
            <ul className="space-y-2">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className={linkClass}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Legal">
            <ul className="space-y-2">
              {LEGAL_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={linkClass}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
