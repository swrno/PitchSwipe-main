import Link from "next/link";
import { BrandMark } from "@/shared/shell/brand-mark";
import { ThemeToggle } from "@/shared/ui/theme-toggle";

const FOOTER_LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/contact", label: "Contact" },
  { href: "/swipe", label: "Start swiping" },
];

const focusRing = "rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Terms, Privacy and Contact: a quiet reading layout with the logo, the theme toggle and footer links. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-app flex-col">
      <a
        href="#legal-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-lime focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-ink"
      >
        Skip to content
      </a>
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-4 md:px-6 md:py-6">
        <Link href="/" className={`inline-flex items-center gap-2.5 pr-2 ${focusRing}`} aria-label="PitchSwipe home">
          <BrandMark className="size-9" />
          <span className="font-display text-lg font-bold tracking-tight">PitchSwipe</span>
        </Link>
        <ThemeToggle />
      </header>

      <main id="legal-main" className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-2 md:px-6 md:pt-6">
        {children}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8 pb-[calc(2rem+var(--safe-bottom))] md:flex-row md:items-center md:justify-between md:px-6">
          <nav aria-label="Legal and help">
            <ul className="flex flex-wrap gap-2">
              {FOOTER_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className={`inline-flex h-9 items-center bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted ${focusRing}`}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <p className="text-sm text-muted-foreground">PitchSwipe. Payouts are not live yet; no real money moves.</p>
        </div>
      </footer>
    </div>
  );
}
