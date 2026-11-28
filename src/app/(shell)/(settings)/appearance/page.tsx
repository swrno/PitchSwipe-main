import type { Metadata } from "next";
import { AppearanceScreen } from "@/features/profile/ui/appearance-screen";

export const metadata: Metadata = { title: "Appearance" };

// Colours live in this browser only (localStorage "ps:palette"), so there is no server data and no sign-in is needed.
export default function AppearancePage() {
  return <AppearanceScreen />;
}
