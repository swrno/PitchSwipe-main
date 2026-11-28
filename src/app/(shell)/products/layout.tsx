import { SignInGate } from "@/shared/shell/sign-in-gate";

/** Every /products/** page is a founder page: signed-in founders with a verified email only (C5). Signed out: a sign-in card. */
export default function ProductsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <SignInGate verified what="your products">
      {children}
    </SignInGate>
  );
}
