import type { Metadata } from "next";
import { explicitNext } from "@/features/auth/next";
import { LoginForm } from "@/features/auth/ui/login-form";

export const metadata: Metadata = { title: "Sign in" };

type Params = Promise<{ next?: string | string[] }>;

export default async function LoginPage({ searchParams }: { searchParams: Params }) {
  const { next } = await searchParams;
  return (
    <LoginForm next={explicitNext(next)} />
  );
}
