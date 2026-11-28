"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/features/auth/ui/provider";
import { withNext } from "@/features/auth/next";
import { buttonVariants } from "@/shared/ui/button";
import { api, ApiError } from "./api";

type State = { kind: "working" } | { kind: "error"; message: string; status: number };

/**
 * /invite/[token]: signs the visitor in if needed (login or sign-up, then back here), accepts the invite with their
 * verified email, and sends them to the product. Must sit inside an AuthProvider.
 */
export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const { user, loading, configured } = useAuth();
  const [state, setState] = React.useState<State>({ kind: "working" });
  const started = React.useRef(false);
  const here = `/invite/${token}`;

  React.useEffect(() => {
    if (loading || !configured || !user || started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await api<{ productId: string }>("/api/invites/accept", { method: "POST", body: { token } });
        router.replace(`/products/${res.productId}`);
      } catch (e) {
        const status = e instanceof ApiError ? e.status : 0;
        setState({ kind: "error", status, message: e instanceof ApiError ? e.message : "Could not accept this invite. Try again." });
      }
    })();
  }, [loading, configured, user, token, router]);

  const signedOut = !loading && configured && !user;
  const link = "text-sm font-semibold underline underline-offset-4";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Join as a co-founder</h1>
      {!configured && !loading ? (
        <p role="alert" className="text-sm text-muted-foreground">Sign-in is not available right now. Try again in a little while.</p>
      ) : signedOut ? (
        <>
          <p className="text-sm text-muted-foreground">Sign in with the email address this invite was sent to, then you will join the product.</p>
          <div className="flex flex-wrap gap-2">
            <Link href={withNext("/login", here)} className={buttonVariants({})}>Sign in</Link>
            <Link href={withNext("/signup", here)} className={buttonVariants({ variant: "outline" })}>Create an account</Link>
          </div>
        </>
      ) : state.kind === "error" ? (
        <div role="alert" className="space-y-3">
          <p className="text-sm">{state.message}</p>
          {state.status === 403 ? <Link href={withNext("/login", here)} className={link}>Sign in with a different account</Link> : null}
          <div><Link href="/decks" className={link}>Go to my products</Link></div>
        </div>
      ) : (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Accepting your invite…
        </p>
      )}
    </main>
  );
}
