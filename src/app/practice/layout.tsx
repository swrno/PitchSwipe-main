import { AuthProvider } from "@/features/auth/ui/provider";

/**
 * /practice is the swiper's step 3 of 3 (designs 30, 31): a focused page without the app shell,
 * like /signup and /verify, so it carries its own AuthProvider.
 */
export default function PracticeLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
