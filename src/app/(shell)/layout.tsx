import Link from "next/link";
import { BrandMark } from "@/components/shell/brand-mark";
import { BottomTabBar, BrandBarAccount, Sidebar } from "@/components/shell/navigation";
import { AuthProvider } from "@/lib/auth/provider";
import { isDemoMode } from "@/lib/decks/store";

/**
 * App shell shared by every signed-in screen.
 * Phone (< md): top logo bar + bottom tab bar. Web (>= md): left sidebar.
 * One AuthProvider for the whole shell: the sidebar account, the phone avatar and the founder gate
 * (/decks, /products layouts) all read the same sign-in state.
 */
export const dynamic = "force-dynamic";

export default function ShellLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const demo = isDemoMode();
  return (
    <AuthProvider>
      {/* overflow-x-clip: a swipe card dragged or thrown off screen must not make the page scroll sideways
          (clip, not hidden, so the sticky answer bar keeps working). */}
      <div className="min-h-app overflow-x-clip bg-background md:bg-canvas md:pl-[var(--sidebar-width)]">
        <Sidebar demo={demo} />
        {/* Must stay a sibling before <main>: globals.css hides .brand-bar when a page sets data-hide-brand-bar. */}
        <BrandBar demo={demo} />
        <main
          className="mx-auto w-full max-w-md px-4 pt-4 md:max-w-[1200px] md:px-8 md:pt-10"
          style={{ paddingBottom: "calc(var(--tabbar-height) + 2rem)" }}
        >
          {children}
        </main>
        <BottomTabBar />
      </div>
    </AuthProvider>
  );
}

function BrandBar({ demo }: { demo: boolean }) {
  return (
    <header className="brand-bar flex h-12 items-center justify-between px-4 md:hidden">
      <Link
        href="/swipe"
        aria-label="PitchSwipe: swipe home"
        className="flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <BrandMark className="size-9" />
      </Link>
      <BrandBarAccount demo={demo} />
    </header>
  );
}
