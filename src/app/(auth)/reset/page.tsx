import type { Metadata } from "next";
import { explicitNext } from "@/features/auth/next";
import { ResetForm } from "@/features/auth/ui/reset-form";

export const metadata: Metadata = { title: "Reset your password" };

type Params = Promise<{ email?: string | string[]; next?: string | string[] }>;

export default async function ResetPage({ searchParams }: { searchParams: Params }) {
  const { email, next } = await searchParams;
  const raw = Array.isArray(email) ? email[0] : email;
  // Only a prefill for the field: trimmed and capped, never echoed anywhere else.
  const initialEmail = typeof raw === "string" ? raw.trim().slice(0, 254) : "";
  return (
    <ResetForm
      initialEmail={initialEmail}
      next={explicitNext(next)}
    />
  );
}
