import type { Metadata } from "next";
import { WalletScreen } from "@/components/claim/wallet-screen";

export const metadata: Metadata = { title: "Wallet" };

export default function WalletPage() {
  return <WalletScreen />;
}
