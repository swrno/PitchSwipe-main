import { FounderGate } from "@/components/shell/founder-gate";
import { isDemoMode } from "@/lib/decks/store";

export const dynamic = "force-dynamic";

/** Every /products/** page is a founder page: signed-in, verified founders only in real mode (C5). Demo passes through. */
export default function ProductsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <FounderGate demo={isDemoMode()}>{children}</FounderGate>;
}
