"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { Button, buttonVariants } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { INDUSTRIES, ROLES, STATES, type Industry } from "@/shared/lib/lists";
import { accentFor, type ProductInput } from "@/features/decks/product";
import { reachView } from "@/features/share/reach";
import type { DeckListItem, DecksOverview, ProductRecord } from "@/features/decks/views";
import { cn } from "@/shared/lib/utils";
import { api, ApiError, errorFor } from "./api";
import { ChipPicker } from "./chip-picker";
import { ErrorText, FieldLabel, Notice, ProductTile, Segmented, StatusText, SubPageNav, TextInput, ToggleChip } from "./primitives";
import type { FieldError } from "@/features/decks/types";

const EMPTY: ProductInput = {
  name: "",
  icon: "",
  category: "",
  industry: "Retail",
  showOwnerName: true,
  targetUsers: [],
  audience: { who: "everyone", states: [], interests: [] },
};

export interface ProductScreenData {
  product?: ProductRecord;
  decks: DeckListItem[];
}

/** F2 Product settings (phone 03, web 04) and /products/new. */
export function ProductScreen({ productId }: { productId?: string }) {
  const router = useRouter();
  const [data, setData] = React.useState<ProductScreenData | undefined>(productId ? undefined : { decks: [] });
  const [form, setForm] = React.useState<ProductInput>(EMPTY);
  const [errors, setErrors] = React.useState<FieldError[]>([]);
  const [message, setMessage] = React.useState<{ tone: "error" | "ok"; text: string }>();
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    Promise.all([api<ProductRecord>(`/api/products/${productId}`), api<DecksOverview>("/api/decks?overview=1")])
      .then(([product, overview]) => {
        if (cancelled) return;
        setForm(toInput(product));
        setData({ product, decks: overview.products.find((p) => p.id === productId)?.decks ?? [] });
      })
      .catch((e: Error) => !cancelled && setMessage({ tone: "error", text: e.message }));
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const reach = reachView();
  const accent = accentFor(form.name || "Product");
  const isNew = !productId;

  async function save() {
    setSaving(true);
    setErrors([]);
    setMessage(undefined);
    try {
      const saved = await api<ProductRecord>(isNew ? "/api/products" : `/api/products/${productId}`, {
        method: isNew ? "POST" : "PATCH",
        body: form,
      });
      if (isNew) router.push(`/decks/new?product=${saved.id}`);
      else setMessage({ tone: "ok", text: "Saved. Changes apply to new decks only, so running tests stay fair." });
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.errors);
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Could not save." });
    } finally {
      setSaving(false);
    }
  }

  if (!data)
    return message?.tone === "error" ? (
      <div role="alert" className="space-y-3">
        <Notice tone="error">{message.text}</Notice>
        <button type="button" onClick={() => window.location.reload()} className="inline-flex h-11 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Try again</button>
      </div>
    ) : (
      <div aria-busy className="space-y-3"><span className="sr-only">Loading</span><div className="h-8 w-1/2 rounded-lg bg-muted motion-safe:animate-pulse" /><div className="h-48 rounded-xl bg-muted motion-safe:animate-pulse" /></div>
    );
  const name = form.name || "New product";

  return (
    <div className="space-y-5">
      <SubPageNav backHref={isNew ? "/products" : `/products/${productId}`} right={<span>{name}</span>} />

      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{isNew ? "New product" : "Product settings"}</h1>
        <div className="hidden items-center gap-2 md:flex">
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save product"}
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground">
        Shared by every deck of this product. Changes apply to new decks only<span className="hidden md:inline">, so running tests stay fair</span>.
      </p>

      <div className="grid gap-5 md:grid-cols-[1fr_27rem]">
        <div className="space-y-5">
          <Card className="space-y-5 p-5">
            <h2 className="text-lg font-semibold tracking-tight hidden md:block">Identity</h2>
            <div className="flex items-end gap-3">
              <ProductTile icon={form.icon || (form.name.slice(0, 1).toUpperCase() || "?")} accent={accent} className="size-[3.25rem] md:size-14" />
              <div className="flex-1">
                <FieldLabel htmlFor="product-name">Name</FieldLabel>
                <TextInput id="product-name" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={60} placeholder="Voice Khata" />
              </div>
            </div>
            <ErrorText message={errorFor(errors, "name")} />

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <FieldLabel htmlFor="product-category">Category line</FieldLabel>
                <TextInput id="product-category" value={form.category} onChange={(e) => set("category", e.target.value)} maxLength={60} placeholder="Voice ledger · Retail" />
                <ErrorText message={errorFor(errors, "category")} />
              </div>
              <div>
                <FieldLabel htmlFor="product-industry" hint="one industry">
                  Industry
                </FieldLabel>
                <select
                  id="product-industry"
                  value={form.industry}
                  onChange={(e) => set("industry", e.target.value as Industry)}
                  className="h-12 w-full rounded-xl border border-border bg-background px-3 text-base"
                >
                  {INDUSTRIES.map((i) => (
                    <option key={i}>{i}</option>
                  ))}
                </select>
                <ErrorText message={errorFor(errors, "industry")} />
              </div>
            </div>

            <div>
              <FieldLabel>Founder shown as</FieldLabel>
              <Segmented
                label="Founder shown as"
                value={form.showOwnerName ? "name" : "anonymous"}
                onChange={(v) => set("showOwnerName", v === "name")}
                options={[
                  { value: "name", label: "My name" },
                  { value: "anonymous", label: "Anonymous" },
                ]}
              />
              {!form.showOwnerName ? (
                <p className="mt-1.5 text-sm text-muted-foreground">Cards say “the founder of {name}”.</p>
              ) : null}
            </div>

            <div>
              <p className="mb-2 font-bold">
                Target user <span className="font-normal text-muted-foreground">· shown on the card as “Made for”</span>
              </p>
              <ChipPicker label="Target user roles" options={ROLES} selected={form.targetUsers} onChange={(v) => set("targetUsers", v)} inline />
              <ErrorText message={errorFor(errors, "targetUsers")} />
              <p className="mt-2 text-sm text-muted-foreground">
                Picked from the same role list swipers choose in their profile. Results split by it automatically, so there is no extra question for swipers.
              </p>
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2 text-lg font-extrabold">
                Audience in the feed <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent">Free</span>
              </h2>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {reach.message}
              </p>
            </div>
            <div className="grid items-start gap-2 md:grid-cols-[6rem_1fr]">
              <span className="pt-2 text-sm font-semibold text-muted-foreground">Who</span>
              <div role="group" aria-label="Who sees this product" className="flex flex-wrap gap-2">
                {(
                  [
                    { value: "everyone", label: "Everyone" },
                    { value: "targetOnly", label: "Target users only" },
                  ] as const
                ).map((o) => (
                  <ToggleChip key={o.value} selected={form.audience.who === o.value} onClick={() => set("audience", { ...form.audience, who: o.value })}>
                    {o.label}
                  </ToggleChip>
                ))}
              </div>
              <span className="pt-2 text-sm font-semibold text-muted-foreground">States</span>
              <ChipPicker label="States" options={STATES} selected={form.audience.states} onChange={(states) => set("audience", { ...form.audience, states })} />
              <span className="pt-2 text-sm font-semibold text-muted-foreground">Interests</span>
              <ChipPicker label="Interests" options={INDUSTRIES} selected={form.audience.interests} onChange={(interests) => set("audience", { ...form.audience, interests })} />
            </div>
            <p className="text-sm text-muted-foreground">
              Every deck of this product uses this audience. Flagsmith still picks one card at random for each swiper inside it. The personal link is not restricted.
            </p>
          </Card>

          {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

          {!isNew ? (
            <Link href={`/products/${productId}/site`} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full md:hidden")}>
              <Globe className="text-accent" /> Ship to website
            </Link>
          ) : null}

          <Button size="lg" onClick={save} disabled={saving} className="w-full md:hidden">
            {saving ? "Saving…" : "Save product"}
          </Button>
        </div>

        {!isNew ? (
          <Card className="hidden h-fit p-5 md:block">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-lg font-extrabold">Decks in this product</h2>
              <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                {data.decks.length} decks · {data.decks.reduce((n, d) => n + d.waitlist, 0)} on the waitlist
              </span>
            </div>
            <ul className="divide-y divide-border">
              {data.decks.map((d) => (
                <li key={d.id} className={cn("flex items-center justify-between py-4")}>
                  <span className="font-semibold">{d.label}</span>
                  <StatusText tone={d.tone}>{d.statusLabel}</StatusText>
                </li>
              ))}
              {data.decks.length === 0 ? <li className="py-4 text-muted-foreground">No decks yet.</li> : null}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function toInput(p: ProductRecord): ProductInput {
  return {
    name: p.name,
    icon: p.icon,
    category: p.category,
    industry: p.industry,
    showOwnerName: p.showOwnerName,
    targetUsers: p.targetUsers,
    audience: p.audience,
  };
}
