import type { Metadata } from "next";
import { AuthProvider } from "@/features/auth/ui/provider";
import { AcceptInvite } from "@/features/decks/ui/accept-invite";

export const metadata: Metadata = { title: "Join as a co-founder", robots: { index: false, follow: false } };

type Params = Promise<{ token: string }>;

export default async function InvitePage({ params }: { params: Params }) {
  const { token } = await params;
  return (
    <AuthProvider>
      <AcceptInvite token={token} />
    </AuthProvider>
  );
}
