import type { Metadata } from "next";
import { WalletScreen } from "@/features/claims/ui/wallet-screen";
import { SignInGate } from "@/shared/shell/sign-in-gate";

export const metadata: Metadata = { title: "Wallet" };

export default function WalletPage() {
  return (
    <SignInGate what="your wallet">
      <WalletScreen />
    </SignInGate>
  );
}
