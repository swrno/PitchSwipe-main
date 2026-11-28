"use client";

import { IconLabel } from "@/shared/ui/icon";
import * as React from "react";
import Link from "next/link";
import { Save, Settings } from "lucide-react";
import { Button, buttonVariants } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { ApiError, api } from "@/features/decks/ui/api";
import { useDeckAndProduct, type BoostData } from "./use-deck-and-product";
import { ChipPicker } from "@/features/decks/ui/chip-picker";
import { Notice, Segmented } from "@/features/decks/ui/primitives";
import { INDUSTRIES, STATES } from "@/shared/lib/lists";
import { describeAudience, reachView } from "@/features/share/reach";
import { cn } from "@/shared/lib/utils";
import { WhoSwipedSkeleton } from "@/shared/ui/page-skeletons";

/** "Who sees it": the audience this test is shown to. It lives on the product; edited here or in Config. Top of the Who swiped tab. */
export function AudienceCard({ deckId }: { deckId: string }) {
  const { data, loadError } = useDeckAndProduct(deckId);
  if (loadError) return <Notice tone="error">{loadError}</Notice>;
  if (!data)
    return (
      <WhoSwipedSkeleton />
    );
  return <Loaded data={data} />;
}

function Loaded({ data }: { data: BoostData }) {
  const { product } = data;
  const [saved, setSaved] = React.useState(product.audience);
  const [draft, setDraft] = React.useState(product.audience);
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: "error" | "ok"; text: string }>();

  const targets = product.targetUsers;
  const reach = reachView();
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);
  const parts = describeAudience(saved, targets);

  async function saveAudience() {
    setSaving(true);
    setMessage(undefined);
    try {
      await api(`/api/products/${product.id}`, {
        method: "PUT",
        body: {
          name: product.name,
          icon: product.icon,
          category: product.category,
          industry: product.industry,
          showOwnerName: product.showOwnerName,
          targetUsers: product.targetUsers,
          audience: draft,
        },
      });
      setSaved(draft);
      setEditing(false);
      setMessage({ tone: "ok", text: "Audience saved. It applies to new tests; running tests keep theirs." });
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof ApiError ? e.message : "Could not save. Try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

        <Card className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">
              <IconLabel icon="target">Who sees it</IconLabel>{" "}
              <span className="text-sm font-medium text-muted-foreground">
                · <span className="md:hidden">from</span>
                <span className="hidden md:inline">set on</span> the product
              </span>
            </h2>
            <Link href={`/products/${product.id}/config`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0 max-md:h-auto max-md:border-0 max-md:bg-transparent max-md:px-0 max-md:underline max-md:underline-offset-2")}>
              <Settings className="hidden md:block" /> Edit product
            </Link>
          </div>
          <p className="text-base leading-relaxed text-muted-foreground">
            <Bold>{parts.roles.join(", ")}</Bold> in <Bold>{parts.states.join(", ")}</Bold> who follow{" "}
            <Bold>{parts.interests.join(", ")}</Bold>.
          </p>
          <p className="text-sm text-muted-foreground">
            {reach.message} · Free · Every test of {product.name} uses this audience.
          </p>
          <button
            type="button"
            aria-expanded={editing}
            onClick={() => setEditing((v) => !v)}
            className="text-sm font-bold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {editing ? "Close" : "Adjust audience"}
          </button>

          {editing ? (
            <div className="space-y-4 border-t border-border pt-4">
              <div>
                <p className="mb-1.5 text-sm font-bold">Who sees it</p>
                <Segmented
                  label="Who sees it"
                  value={draft.who}
                  onChange={(who) => setDraft((d) => ({ ...d, who }))}
                  options={[
                    { value: "everyone", label: "Everyone" },
                    { value: "targetOnly", label: "Target users only" },
                  ]}
                />
                {draft.who === "targetOnly" && targets.length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">Pick target users in Edit product first.</p>
                ) : null}
              </div>
              <div>
                <p className="mb-1.5 text-sm font-bold">
                  States <span className="font-normal text-muted-foreground">none = all of India</span>
                </p>
                <ChipPicker
                  label="States"
                  options={STATES}
                  selected={[...draft.states]}
                  onChange={(states) => setDraft((d) => ({ ...d, states }))}
                />
              </div>
              <div>
                <p className="mb-1.5 text-sm font-bold">
                  Interests <span className="font-normal text-muted-foreground">none = any</span>
                </p>
                <ChipPicker
                  label="Interests"
                  options={INDUSTRIES}
                  selected={[...draft.interests]}
                  onChange={(interests) => setDraft((d) => ({ ...d, interests }))}
                />
              </div>
              <div aria-live="polite" className="rounded-xl bg-muted p-3 text-sm">
                <p className="text-muted-foreground">{reach.message}</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={saveAudience} disabled={!dirty || saving}>
                  <Save /> {saving ? "Saving..." : "Save audience"}
                </Button>
                <Button variant="outline" onClick={() => setDraft(saved)} disabled={!dirty || saving}>
                  Reset
                </Button>
              </div>
            </div>
          ) : null}
        </Card>

    </div>
  );
}

function Bold({ children }: { children: React.ReactNode }) {
  return <strong className="font-extrabold text-foreground">{children}</strong>;
}
