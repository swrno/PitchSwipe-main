import type { Metadata } from "next";
import { previewAllowed } from "@/lib/auth/preview";
import { explicitNext } from "@/lib/auth/next";
import { isDemoMode } from "@/lib/decks/store";
import { VerifyPanel } from "@/components/auth/verify-panel";

export const metadata: Metadata = { title: "Verify your email" };

type Params = Promise<{ demo?: string | string[]; next?: string | string[] }>;

export default async function VerifyPage({ searchParams }: { searchParams: Params }) {
  const { demo, next } = await searchParams;
  return (
    <VerifyPanel
      next={explicitNext(next)}
      demo={isDemoMode()}
      preview={previewAllowed(demo)}
      previewHref={previewAllowed("1") ? "/verify?demo=1" : undefined}
    />
  );
}
