import type { Metadata } from "next";
import { ProfileScreen } from "@/features/profile/ui/profile-screen";
import { safeNext } from "@/features/auth/next";

export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

// No Profile mockup exists in designs (see docs/designs/README.md "Gaps"). Built from spec 03 §5.12 in the swipe home's style.
// Only ever shows the signed-in user's own data; signed out shows a sign-in card.
export default async function ProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const complete = (Array.isArray(params.complete) ? params.complete[0] : params.complete) === "1";
  return <ProfileScreen complete={complete} next={safeNext(params.next)} />;
}
