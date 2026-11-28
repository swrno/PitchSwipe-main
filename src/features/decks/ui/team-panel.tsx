"use client";

import { IconLabel } from "@/shared/ui/icon";
import * as React from "react";
import { Check, Copy, Loader2, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import { api, ApiError } from "./api";
import type { MemberView } from "../members";

interface TeamResponse {
  role: "owner" | "cofounder";
  members: MemberView[];
}

interface InviteResponse {
  member: MemberView;
  inviteUrl: string;
  emailed: boolean;
}

function pill(m: MemberView): { label: string; className: string } {
  if (m.status === "active") return { label: "Active", className: "bg-accent/15 text-accent" };
  if (m.expired) return { label: "Expired", className: "bg-muted text-muted-foreground" };
  return { label: "Invited", className: "bg-muted text-foreground" };
}

/**
 * The team of one product: co-founders with status pills. Owners can invite by email, copy the invite link and remove
 * people; co-founders see the list without those controls. Standalone: give it a product id.
 */
export function TeamPanel({ productId, className }: { productId: string; className?: string }) {
  const [team, setTeam] = React.useState<TeamResponse | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  /** Links made in this session, by member id: the server keeps only a hash, so an old invite has no link to copy. */
  const [links, setLinks] = React.useState<Record<string, string>>({});
  const [copied, setCopied] = React.useState<string | null>(null);
  const base = `/api/products/${encodeURIComponent(productId)}/members`;

  const load = React.useCallback(async () => {
    try {
      setTeam(await api<TeamResponse>(base));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "Could not load the team.");
    }
  }, [base]);

  React.useEffect(() => {
    let live = true;
    api<TeamResponse>(base)
      .then((t) => live && setTeam(t))
      .catch((e) => live && setLoadError(e instanceof ApiError ? e.message : "Could not load the team."));
    return () => {
      live = false;
    };
  }, [base]);

  async function copy(memberId: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(memberId);
      window.setTimeout(() => setCopied((c) => (c === memberId ? null : c)), 2000);
    } catch {
      setNote(url); // Clipboard blocked: show the link so it can be copied by hand.
    }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await api<InviteResponse>(base, { method: "POST", body: { email } });
      setLinks((l) => ({ ...l, [res.member.id]: res.inviteUrl }));
      setEmail("");
      setNote(res.emailed ? `Invite emailed to ${res.member.email}.` : `Email is not set up here. Copy the invite link for ${res.member.email} and send it yourself.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the invite. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(m: MemberView) {
    if (!window.confirm(`Remove ${m.email}? They lose access to this product right away.`)) return;
    setError(null);
    try {
      await api(`${base}/${encodeURIComponent(m.id)}`, { method: "DELETE" });
      setLinks((l) => Object.fromEntries(Object.entries(l).filter(([id]) => id !== m.id)));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove this person. Try again.");
    }
  }

  if (loadError) return <p role="alert" className={cn("text-sm text-muted-foreground", className)}>{loadError}</p>;
  if (!team) return <div aria-busy className={cn("h-32 rounded-xl bg-muted motion-safe:animate-pulse", className)}><span className="sr-only">Loading the team</span></div>;
  const isOwner = team.role === "owner";

  return (
    <section aria-labelledby="team-heading" className={cn("space-y-4 rounded-xl border border-border bg-card p-5", className)}>
      <div>
        <h2 id="team-heading" className="text-lg font-semibold tracking-tight"><IconLabel icon="cofounders">Co-founders</IconLabel></h2>
        <p className="text-sm text-muted-foreground">
          {isOwner
            ? "Can build and publish tests. Only you manage the team."
            : "You are a co-founder here. Only the owner manages the team."}
        </p>
      </div>

      {team.members.length === 0 ? (
        <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">No co-founders yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {team.members.map((m) => {
            const p = pill(m);
            const link = links[m.id];
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
                <span className="min-w-0 basis-full truncate text-sm font-medium">{m.email}</span>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", p.className)}>{p.label}</span>
                {isOwner && m.status === "invited" && link ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => void copy(m.id, link)}>
                    {copied === m.id ? <Check /> : <Copy />} {copied === m.id ? "Copied" : "Copy invite link"}
                  </Button>
                ) : null}
                {isOwner ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => void remove(m)} aria-label={`Remove ${m.email}`}>
                    <Trash2 /> {m.status === "invited" ? "Cancel" : "Remove"}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {isOwner ? (
        <form onSubmit={invite} className="flex flex-col gap-2" noValidate>
          <label htmlFor="team-invite-email" className="sr-only">Co-founder email</label>
          <input
            id="team-invite-email"
            type="email"
            autoComplete="off"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@example.com"
            className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" className="w-full" disabled={busy || email.trim() === ""}>
            {busy ? <Loader2 className="animate-spin" /> : <UserPlus />} Invite
          </Button>
        </form>
      ) : null}

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {note ? <p role="status" className="break-all text-sm text-muted-foreground">{note}</p> : null}
    </section>
  );
}
