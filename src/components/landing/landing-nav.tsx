import Link from "next/link";
import { BrandMark } from "@/components/shell/brand-mark";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NavAuth } from "./nav-auth";

const LINKS = [
  { href: "#founders", label: "For founders" },
  { href: "#swipers", label: "For swipers" },
  { href: "#pricing", label: "Pricing" },
];

/** Sticky top bar: logo, section links (desktop), theme toggle, and the auth-aware buttons. */
export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 md:h-[4.5rem] md:px-8">
        <Link
          href="/"
          aria-label="PitchSwipe home"
          className="mr-auto flex items-center gap-1.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <BrandMark className="size-8" />
          <span className="font-display text-lg font-bold tracking-tight max-[359px]:sr-only">PitchSwipe</span>
        </Link>

        <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 md:ml-3 md:gap-2">
          <ThemeToggle className="size-9 w-9 md:size-10 md:w-10" />
          <NavAuth />
        </div>
      </div>
    </header>
  );
}
