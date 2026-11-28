"use client";

import Link from "next/link";
import { AuthProvider, useAuth } from "@/features/auth/ui/provider";
import { buttonVariants } from "@/shared/ui/button";
import { ArrowChip } from "@/shared/ui/mascot";
import { cn } from "@/shared/lib/utils";

/**
 * The only auth-aware part of the landing page. Signed-out visitors (and the first render, while Firebase is still
 * loading) see "Sign in" and "Get started"; a signed-in visitor, or any visitor on a server without Firebase client
 * config, sees "Open the app".
 */
export function NavAuth() {
  return (
    <AuthProvider>
      <NavAuthButtons />
    </AuthProvider>
  );
}

function NavAuthButtons() {
  const { user, loading, configured } = useAuth();
  const signedIn = configured && !loading && !!user;

  // Without Firebase client config Sign in and Get started would only show "Sign-in is not
  // available", so offer the app itself. `configured` comes from NEXT_PUBLIC_* values, the same on server and client.
  if (signedIn || !configured) {
    return (
      <Link href="/swipe" className={cn(buttonVariants({ variant: "lime", size: "sm" }), "gap-1.5 pl-4 pr-1.5")}>
        Open the app
        <ArrowChip tone="ink" className="size-6" />
      </Link>
    );
  }

  return (
    <>
      <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "px-3")}>
        Sign in
      </Link>
      <Link href="/signup" className={cn(buttonVariants({ variant: "lime", size: "sm" }), "px-4")}>
        Get started
      </Link>
    </>
  );
}
