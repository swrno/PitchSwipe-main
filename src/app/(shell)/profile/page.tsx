import type { Metadata } from "next";
import { ProfileScreen } from "@/components/profile/profile-screen";
import { demoProfile } from "@/components/profile/demo-profile";
import { safeNext } from "@/lib/auth/next";
import { isDemoMode } from "@/lib/decks/store";

export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

// No Profile mockup exists in designs (see docs/designs/README.md "Gaps"). Built from spec 03 §5.12 in the swipe home's style.
// Demo mode shows the fixture swiper read-only; real mode only ever shows the signed-in user's own data.
export default async function ProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const complete = (Array.isArray(params.complete) ? params.complete[0] : params.complete) === "1";
  return <ProfileScreen demo={isDemoMode() ? demoProfile() : null} complete={complete} next={safeNext(params.next)} />;
}
