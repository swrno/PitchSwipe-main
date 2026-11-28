import Link from "next/link";
import { AskFab } from "@/features/ask/ui/ask-fab";
import { BrandMark } from "@/shared/shell/brand-mark";
import { BottomTabBar, BrandBarAccount } from "@/shared/shell/navigation";
import { ShellFrame } from "@/shared/shell/shell-frame";
import { TopBar } from "@/shared/shell/top-bar";
import { AuthProvider } from "@/features/auth/ui/provider";
import { NotConfigured } from "@/shared/shell/not-configured";
import { isServerConfigured } from "@/shared/lib/config";

/**
 * App shell shared by every signed-in screen.
 * Phone (< md): top logo bar + bottom tab bar. Web (>= md): left sidebar.
 * One AuthProvider for the whole shell: the sidebar account, the phone avatar and the founder gate
 * (/decks, /products layouts) all read the same sign-in state.
 */
export const dynamic = "force-dynamic";

export default function ShellLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Without MongoDB and the Firebase keys every screen shows the not-configured message instead of data.
  const configured = isServerConfigured();
  return (
    <AuthProvider>
      <ShellFrame>
        {/* Must stay a sibling before <main>: globals.css hides .brand-bar when a page sets data-hide-brand-bar. */}
        <BrandBar />
        <TopBar />
        <main
          className="mx-auto w-full max-w-md px-4 pt-4 md:max-w-[1200px] md:px-8 md:pt-10"
          style={{ paddingBottom: "calc(var(--tabbar-height) + 2rem)" }}
        >
          {configured ? children : <NotConfigured />}
        </main>
        <BottomTabBar />
        <AskFab />
      </ShellFrame>
    </AuthProvider>
  );
}

function BrandBar() {
  return (
    <header className="brand-bar flex h-12 items-center justify-between px-4 md:hidden">
      <Link
        href="/swipe"
        aria-label="PitchSwipe: swipe home"
        className="flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <BrandMark className="size-9" />
      </Link>
      <BrandBarAccount />
    </header>
  );
}
