import { SignInGate } from "@/shared/shell/sign-in-gate";

/** Every /decks/** page is a founder page: signed-in founders with a verified email only (C5). Signed out: a sign-in card. */
export default function DecksLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <SignInGate verified what="your tests">
      {children}
    </SignInGate>
  );
}
