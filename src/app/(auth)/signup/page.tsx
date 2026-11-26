import type { Metadata } from "next";
import { previewAllowed } from "@/lib/auth/preview";
import { explicitNext } from "@/lib/auth/next";
import { isDemoMode } from "@/lib/decks/store";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create your profile" };

type Params = Promise<{ demo?: string | string[]; next?: string | string[] }>;

export default async function SignupPage({ searchParams }: { searchParams: Params }) {
  const { demo, next } = await searchParams;
  return (
    <SignupForm
      next={explicitNext(next)}
      demo={isDemoMode()}
      preview={previewAllowed(demo)}
      previewHref={previewAllowed("1") ? "/signup?demo=1" : undefined}
    />
  );
}
