import type { Metadata } from "next";
import { explicitNext } from "@/features/auth/next";
import { VerifyPanel } from "@/features/auth/ui/verify-panel";

export const metadata: Metadata = { title: "Verify your email" };

type Params = Promise<{ next?: string | string[] }>;

export default async function VerifyPage({ searchParams }: { searchParams: Params }) {
  const { next } = await searchParams;
  return (
    <VerifyPanel next={explicitNext(next)} />
  );
}
