import type { Metadata } from "next";
import { previewAllowed } from "@/lib/auth/preview";
import { explicitNext } from "@/lib/auth/next";
import { ResetForm } from "@/components/auth/reset-form";

export const metadata: Metadata = { title: "Reset your password" };

type Params = Promise<{ demo?: string | string[]; email?: string | string[]; next?: string | string[] }>;

export default async function ResetPage({ searchParams }: { searchParams: Params }) {
  const { demo, email, next } = await searchParams;
  const raw = Array.isArray(email) ? email[0] : email;
  // Only a prefill for the field: trimmed and capped, never echoed anywhere else.
  const initialEmail = typeof raw === "string" ? raw.trim().slice(0, 254) : "";
  return (
    <ResetForm
      initialEmail={initialEmail}
      next={explicitNext(next)}
      preview={previewAllowed(demo)}
      previewHref={previewAllowed("1") ? "/reset?demo=1" : undefined}
    />
  );
}
