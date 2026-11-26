import type { Metadata } from "next";
import { previewAllowed } from "@/lib/auth/preview";
import { explicitNext } from "@/lib/auth/next";
import { isDemoMode } from "@/lib/decks/store";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

type Params = Promise<{ demo?: string | string[]; next?: string | string[] }>;

export default async function LoginPage({ searchParams }: { searchParams: Params }) {
  const { demo, next } = await searchParams;
  return (
    <LoginForm
      next={explicitNext(next)}
      demo={isDemoMode()}
      preview={previewAllowed(demo)}
      previewHref={previewAllowed("1") ? "/login?demo=1" : undefined}
    />
  );
}
