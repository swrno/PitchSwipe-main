import { SignInGate } from "@/shared/shell/sign-in-gate";

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <SignInGate verified what="your swipe history">
      {children}
    </SignInGate>
  );
}
