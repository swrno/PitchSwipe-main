import type { Metadata } from "next";
import { explicitNext } from "@/features/auth/next";
import { SignupForm } from "@/features/auth/ui/signup-form";

export const metadata: Metadata = { title: "Create your profile" };

type Params = Promise<{ next?: string | string[] }>;

export default async function SignupPage({ searchParams }: { searchParams: Params }) {
  const { next } = await searchParams;
  return (
    <SignupForm next={explicitNext(next)} />
  );
}
