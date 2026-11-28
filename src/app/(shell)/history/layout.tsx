import { PageHeader } from "@/shared/shell/page-header";
import { SignInGate } from "@/shared/shell/sign-in-gate";

/** History: every card the swiper answered (its own page, next to Swipe in the sidebar). */
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div>
      <PageHeader icon="history" title="History" description="Every card you answered, newest first." />
      <SignInGate verified what="your swipe history">
        {children}
      </SignInGate>
    </div>
  );
}
