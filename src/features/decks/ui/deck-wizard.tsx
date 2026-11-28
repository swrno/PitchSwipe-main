"use client";

import { invalidateDecksUsed } from "./decks-left";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Download, RotateCcw, Flag, Link2, Lock, Plus, Sparkles } from "lucide-react";
import { buttonVariants } from "@/shared/ui/button";
import { Button } from "@/shared/ui/button";
import { haptic } from "@/shared/lib/feel/haptics";
import { SPRING_SNAPPY } from "@/shared/lib/feel/motion";
import { Card } from "@/shared/ui/card";
import { lockedRows } from "@/features/decks/lock";
import { accentFor } from "@/features/decks/product";
import { cardCountRange, TESTED_SHARED_KEYS, VARIANT_KEYS, type CardLanguage, type LanguageValue } from "@/features/decks/fields";
import type { DeckRecord, FieldError } from "@/features/decks/types";
import {
  addVersion,
  emptyForm,
  fromDeckRecord,
  previewCard,
  removeVersion,
  switchPriceMode,
  switchVariable,
  toDeckInput,
  type VersionValue,
  type WizardForm,
} from "@/features/decks/wizard";
import type { ProductRecord } from "@/features/decks/views";
import { TEST_VARIABLES, TEST_VARIABLE_LABELS, type TestVariable } from "@/shared/lib/lists";
import { cn } from "@/shared/lib/utils";
import { AiPreviewSheet } from "./ai-preview-sheet";
import { IdeaStep, type IdeaResult } from "./idea-step";
import { api, ApiError, errorFor } from "./api";
import { CardPreview } from "./card-preview";
import {
  LanguageVersions,
  LogoVersions,
  ScreenshotSlots,
  ScreenshotVersions,
  TextVersions,
} from "./version-editors";
import { PageHeader } from "@/shared/shell/page-header";
import { useBreadcrumb } from "@/shared/shell/breadcrumb";
import { ErrorText, FieldLabel, Notice, Segmented, StepProgress, TextArea, TextInput, ToggleChip } from "./primitives";

const VARIABLE_NOUN: Record<TestVariable, { plural: string; versions: string }> = {
  headline: { plural: "headlines", versions: "headline" },
  description: { plural: "descriptions", versions: "description" },
  reward: { plural: "rewards", versions: "reward" },
  price: { plural: "prices", versions: "price" },
  productUI: { plural: "product UI sets", versions: "screenshots" },
  logo: { plural: "logos", versions: "logo" },
  language: { plural: "languages", versions: "language" },
};

interface Props {
  productId?: string;
  draftId?: string;
  /** Open on "Tell me what's on your mind" first (a new deck, not a reopened draft or a chosen product). */
  startWithIdea?: boolean;
}

/** Puts an AI idea draft into the form: shared fields, and the first version of the tested text variable. */
function applyIdea(form: WizardForm, d: IdeaResult["draft"]): WizardForm {
  const next: WizardForm = { ...form, headline: d.headline || form.headline, description: d.description || form.description, reward: d.reward || form.reward };
  const seed = next.variable === "headline" ? d.headline : next.variable === "description" ? d.description : next.variable === "reward" ? d.reward : "";
  if (seed && typeof next.versions[0] === "string" && !(next.versions[0] as string).trim()) next.versions = next.versions.map((v, i) => (i === 0 ? seed : v));
  return next;
}

/**
 * F4 New deck (phone 05..11, web 07..13): choose ONE variable, write 2 to 3
 * versions, review the locked "Same on every card" fields, preview the card,
 * then Save draft / Test with AI personas / Publish. The server re-checks every
 * rule (src/features/decks); this screen only guides.
 */
export function DeckWizard({ productId, draftId, startWithIdea = false }: Props) {
  const [products, setProducts] = React.useState<ProductRecord[] | undefined>();
  const [form, setForm] = React.useState<WizardForm | undefined>();
  const [deckId, setDeckId] = React.useState<string | undefined>();
  const [deckStatus, setDeckStatus] = React.useState<DeckRecord["status"] | undefined>();
  const [errors, setErrors] = React.useState<FieldError[]>([]);
  const [message, setMessage] = React.useState<{ tone: "error" | "ok" | "muted"; text: string }>();
  const [busy, setBusy] = React.useState<"draft" | "publish" | "ai">();
  const [previewIndex, setPreviewIndex] = React.useState(0);
  const reduceMotion = useReducedMotion();
  const [aiOpen, setAiOpen] = React.useState(false);
  const [changing, setChanging] = React.useState(false);
  const [editingShared, setEditingShared] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string>();
  const [stage, setStage] = React.useState<"idea" | "wizard">(startWithIdea ? "idea" : "wizard");
  const [idea, setIdea] = React.useState<IdeaResult>();
  const [published, setPublished] = React.useState<{ id: string; slug: string; copied?: boolean }>();
  const [ideaApplied, setIdeaApplied] = React.useState(false);

  // Pre-fill the wizard once the form exists (it can still be loading in MongoDB mode): state adjusted during render.
  if (idea && !ideaApplied && form) {
    setIdeaApplied(true);
    setForm(applyIdea(form, idea.draft));
  }

  // Load the founder's products (and the draft being reopened).
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = (await api<{ products: ProductRecord[] }>("/api/products")).products;
        const draft = draftId ? await api<DeckRecord>(`/api/decks/${draftId}`) : undefined;
        if (cancelled) return;
        setProducts(list);
        if (draft) {
          setDeckId(draft._id);
          setDeckStatus(draft.status);
          setForm(fromDeckRecord(draft));
        } else if (list.length > 0) {
          setForm(emptyForm(list.find((p) => p.id === productId)?.id ?? list[0].id));
        }
      } catch (e) {
        if (!cancelled) setMessage({ tone: "error", text: e instanceof Error ? e.message : "Could not load your products." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId, draftId]);

  if (stage === "idea") {
    return (
      <IdeaStep
        onSkip={() => setStage("wizard")}
        onDrafted={(r) => {
          setIdea(r);
          setStage("wizard");
        }}
      />
    );
  }

  if (!products)
    return message?.tone === "error" ? (
      <div role="alert" className="space-y-3">
        <Notice tone="error">{message.text}</Notice>
        <button type="button" onClick={() => window.location.reload()} className={cn(buttonVariants({ variant: "outline" }), "h-11")}>
          <RotateCcw /> Try again
        </button>
      </div>
    ) : (
      <div aria-busy className="space-y-6">
        <div className="h-8 w-1/2 rounded-lg bg-muted motion-safe:animate-pulse" />
        <div className="h-64 rounded-xl bg-muted motion-safe:animate-pulse" />
      </div>
    );

  if (products.length === 0 || !form) {
    return (
      <div className="space-y-6">
        <PageHeader icon="newTest" title="New test" description="A test lives inside a product." className="mb-0" />
        <Notice>A test lives inside a product. Create your first product, then come back.</Notice>
        <Link href="/products/new" className="inline-flex h-12 items-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground">
          New product
        </Link>
      </div>
    );
  }

  const f = form;
  const product = products.find((p) => p.id === f.productId) ?? products[0];
  const locked = deckStatus !== undefined && deckStatus !== "draft";
  const tested = TESTED_SHARED_KEYS[f.variable];
  const range = cardCountRange(f.variable, f.variable === "price" ? f.priceMode : undefined);
  const canAdd = f.versions.length < range.max;
  const canRemove = f.versions.length > range.min;
  const noun = VARIABLE_NOUN[f.variable];
  const input = toDeckInput(f);
  const rows = lockedRows(input);
  const shownRows = rows.slice(0, 3);
  const moreLocked = rows.slice(3).map((r) => r.label.toLowerCase());
  const safePreview = Math.min(previewIndex, f.versions.length - 1);

  const update = (patch: Partial<WizardForm>) => setForm((cur) => (cur ? { ...cur, ...patch } : cur));
  const setVersion = (i: number, value: VersionValue) =>
    setForm((cur) => (cur ? { ...cur, versions: cur.versions.map((v, j) => (j === i ? value : v)) } : cur));

  async function submit(publish: boolean) {
    setBusy(publish ? "publish" : "draft");
    setErrors([]);
    setMessage(undefined);
    try {
      const body = { ...toDeckInput(f), ...(publish ? { publish: true } : {}) };
      const saved = deckId
        ? await api<DeckRecord>(`/api/decks/${deckId}`, { method: "PATCH", body })
        : await api<DeckRecord>("/api/decks", { method: "POST", body });
      invalidateDecksUsed();
      setDeckId(saved._id);
      setDeckStatus(saved.status);
      if (publish) {
        setPublished({ id: saved._id, slug: saved.slug });
        return;
      }
      setMessage({ tone: "ok", text: "Draft saved. Nothing is live. Find it under Drafts on My tests." });
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.errors);
        const detail = e.errors.slice(0, 3).map((x) => x.message).join(" ");
        setMessage({ tone: "error", text: detail ? `${e.message} ${detail}` : e.message });
        if (e.status === 409) setDeckStatus((s) => s ?? "live");
      } else setMessage({ tone: "error", text: "Could not save. Try again." });
    } finally {
      setBusy(undefined);
    }
  }

  async function draftWithAi() {
    setBusy("ai");
    setMessage(undefined);
    try {
      // What the card says today, so the drafts stay about this product.
      const firstText = f.versions.find((v): v is string => typeof v === "string" && v.trim() !== "");
      const idea = { headline: f.variable === "headline" ? (firstText ?? "") : f.headline, description: f.variable === "description" ? (firstText ?? "") : f.description };
      const res = await api<{ versions: string[] }>("/api/decks/draft-ai", {
        method: "POST",
        body: { kind: "versions", variable: f.variable, count: 3, productId: f.productId, idea },
      });
      if (res.versions.length === 0) {
        setMessage({
          tone: "muted",
          text:
            f.variable === "headline" || f.variable === "description"
              ? "No usable drafts came back. Write your versions by hand."
              : "AI drafts headlines and descriptions. Write these versions by hand.",
        });
      } else {
        setForm((cur) => (cur ? { ...cur, versions: res.versions.map((v) => v as VersionValue).slice(0, range.max) } : cur));
        setMessage({ tone: "muted", text: "AI drafted these. Read and edit them before you publish." });
      }
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "AI drafting failed." });
    } finally {
      setBusy(undefined);
    }
  }

  async function translate() {
    const english = f.versions.find((v) => (v as LanguageValue).language === "English") as LanguageValue | undefined;
    const targets = f.versions.map((v) => (v as LanguageValue).language).filter((l): l is CardLanguage => l !== "English");
    if (!english?.headline.trim() || targets.length === 0) {
      setMessage({ tone: "error", text: "Write the English card first, then translate." });
      return;
    }
    setBusy("ai");
    setMessage(undefined);
    try {
      const { language: _l, ...base } = english;
      void _l;
      const res = await api<{ versions: LanguageValue[]; failed?: { language: CardLanguage; reason: string }[] }>("/api/decks/draft-ai", {
        method: "POST",
        body: { kind: "language", base, languages: targets },
      });
      setForm((cur) =>
        cur ? { ...cur, versions: cur.versions.map((v) => res.versions.find((d) => d.language === (v as LanguageValue).language) ?? v) } : cur,
      );
      const failed = res.failed ?? [];
      setMessage(
        failed.length > 0
          ? {
              tone: "error",
              text: `Not drafted: ${failed.map((x) => `${x.language} (${x.reason})`).join(", ")}. Write ${failed.length === 1 ? "it" : "them"} by hand or try again.`,
            }
          : { tone: "muted", text: "AI drafted the translations. Check them before you publish." },
      );
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Translation failed." });
    } finally {
      setBusy(undefined);
    }
  }

  const editorProps = {
    form: f,
    errors,
    onVersion: setVersion,
    onRemove: (i: number) => setForm((cur) => (cur ? removeVersion(cur, i) : cur)),
    canRemove,
  };

  const totalSteps = startWithIdea ? 3 : 2;

  if (published) {
    const link = `${window.location.origin}/d/${encodeURIComponent(published.slug)}`;
    return (
      <div className="max-w-xl space-y-6">
        <Crumbs items={[{ label: "Products", href: "/products" }, { label: product.name, href: `/products/${product.id}` }, { label: "New test" }]} />
        <PageHeader icon="statusLive" title="Your test is live" description="Swipers can see it now." className="mb-0" />
        <StepProgress step={totalSteps} total={totalSteps} label="Live" />
        <div className="space-y-4 rounded-xl border border-border bg-card p-6 text-center" role="status">
          <CheckCircle2 aria-hidden className="mx-auto size-10 text-accent" />
          <p className="text-muted-foreground">
            Results appear as people swipe, and we tell you when a winner is clear. Share your link to get the first swipes.
          </p>
          <p className="break-all rounded-lg bg-muted px-3 py-2 text-sm">{link}</p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className={cn(buttonVariants({ variant: "default" }), "h-11 w-full")}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setPublished((p) => (p ? { ...p, copied: true } : p));
                } catch {
                  /* link stays visible to copy by hand */
                }
              }}
            >
              <Link2 aria-hidden /> {published.copied ? "Link copied" : "Copy share link"}
            </button>
            <Link href={`/decks/${published.id}`} className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}>
              View results
            </Link>
            <Link href="/decks/new" className="min-h-11 content-center text-sm font-medium text-muted-foreground hover:text-foreground">
              Create another test
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Crumbs items={[{ label: "Products", href: "/products" }, { label: product.name, href: `/products/${product.id}` }, { label: "New test" }]} />
      <PageHeader
        className="mb-0"
        title="New test"
        description={
          <>
            For <span className="font-semibold text-foreground">{product.name}</span> ·{" "}
            <button type="button" className="font-semibold text-foreground underline" onClick={() => setChanging((v) => !v)} disabled={locked}>
              Change
            </button>
          </>
        }
        actions={
          <div className="hidden gap-2 md:flex">
            <ActionButtons busy={busy} locked={locked} onDraft={() => submit(false)} onAi={() => setAiOpen(true)} onPublish={() => submit(true)} />
          </div>
        }
      />
      <StepProgress step={totalSteps - 1} total={totalSteps} label="Build your test" />

      {changing ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted p-3">
          <label htmlFor="deck-product" className="text-sm font-semibold">
            Product
          </label>
          <select
            id="deck-product"
            value={f.productId}
            onChange={(e) => {
              update({ productId: e.target.value });
              setChanging(false);
            }}
            className="h-10 rounded-lg border border-border bg-background px-3"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Link href="/products/new" className="text-sm font-semibold underline">
            New product
          </Link>
        </div>
      ) : null}

      {idea ? (
        <div className="space-y-1 rounded-xl border border-border bg-card p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <Sparkles className="size-4 text-accent" /> Drafted from your words. Read it and edit it before you publish.
          </p>
          <p className="text-muted-foreground">
            Suggested product details{idea.draft.name ? `: ${idea.draft.name}` : ""}, industry {idea.draft.industry}, for {idea.draft.audience.toLowerCase()}. Set these on the product.
            {idea.note ? ` ${idea.note}` : ""}
          </p>
        </div>
      ) : null}

      {locked ? (
        <Notice tone="muted">
          <span className="flex items-center gap-2 font-semibold text-foreground">
            <Lock className="size-4" /> This test is published, so its cards are locked.
          </span>
          Cards never change after the experiment starts, so the result stays fair. To test a change, start a new test.
        </Notice>
      ) : null}

      <fieldset disabled={locked} className="min-w-0 space-y-5">
      {/* 1. What are you testing */}
      <Card className="p-5 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-lg md:text-xl">
            <span className="hidden md:inline">1. </span>What are you testing?
          </h2>
          <span className="hidden text-sm text-muted-foreground md:inline">Only this changes between cards</span>
        </div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What are you testing?">
          {TEST_VARIABLES.map((v) => (
            <ToggleChip
              key={v}
              selected={f.variable === v}
              onClick={() => {
                setForm((cur) => (cur ? switchVariable(cur, v) : cur));
                setErrors([]);
                setPreviewIndex(0);
              }}
            >
              {TEST_VARIABLE_LABELS[v]}
            </ToggleChip>
          ))}
        </div>
        <p className="mt-3 text-muted-foreground">
          <span className="md:hidden">Only this changes between cards. Everything else stays the same, so you know what made the difference.</span>
          <span className="hidden md:inline">Change one thing at a time. If two things change, you will not know which one made the difference.</span>
        </p>
      </Card>

        <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="space-y-5">
            {/* 2. Versions */}
            <Card className="space-y-4 p-5 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-lg md:text-xl">
                  <span className="hidden md:inline">2. Your versions</span>
                  <span className="md:hidden">
                    {f.variable === "price" ? `Your ${f.versions.length} prices` : `Your ${f.versions.length} ${noun.plural}`}
                    {f.variable === "price" && f.priceMode === "level" ? (
                      <span className="font-medium text-muted-foreground"> · same unit, 2 to 4 prices</span>
                    ) : null}
                  </span>
                </h2>
                {f.variable !== "language" && f.variable !== "productUI" && f.variable !== "logo" ? (
                  <Button variant="outline" size="sm" onClick={draftWithAi} disabled={busy === "ai"}>
                    <Sparkles className="text-accent" /> {f.variable === "price" && f.priceMode === "level" ? "Suggest prices" : `Draft ${f.versions.length} with AI`}
                  </Button>
                ) : null}
              </div>

              {f.variable === "price" ? (
                <Segmented
                  label="Kind of price test"
                  value={f.priceMode}
                  onChange={(m) => setForm((cur) => (cur ? switchPriceMode(cur, m) : cur))}
                  options={[
                    {
                      value: "level",
                      label: (
                        <>
                          Find the best price<span className="hidden md:inline">: 2 to 4 prices, same unit</span>
                        </>
                      ),
                    },
                    {
                      value: "framing",
                      label: (
                        <>
                          Test framing<span className="hidden md:inline">: same price, different wording</span>
                        </>
                      ),
                    },
                  ]}
                />
              ) : null}

              {f.variable === "productUI" ? (
                <ScreenshotVersions {...editorProps} />
              ) : f.variable === "logo" ? (
                <LogoVersions {...editorProps} />
              ) : f.variable === "language" ? (
                <LanguageVersions {...editorProps} onTranslate={translate} translating={busy === "ai"} />
              ) : (
                <TextVersions {...editorProps} />
              )}

              {f.variable === "price" ? (
                <p className="text-sm text-muted-foreground">
                  {f.priceMode === "level"
                    ? "With 3 or 4 prices you get a demand curve and the price that earns the most."
                    : "Same price, different wording, for example “Rs 10 a day” vs “Rs 299 a month”."}
                </p>
              ) : null}

              <div className="flex items-center justify-between">
                {canAdd ? (
                  <Button variant="outline" size="sm" onClick={() => setForm((cur) => (cur ? addVersion(cur) : cur))}>
                    <Plus /> Add version {VARIANT_KEYS[f.versions.length]}
                  </Button>
                ) : (
                  <span className="text-sm text-muted-foreground">Up to {range.max} versions.</span>
                )}
              </div>
              <ErrorText message={errors.find((e) => e.path === "cards" || e.path === "variable" || e.path === "priceMode")?.message} />
            </Card>

            {/* Product link */}
            <div className="flex gap-3 rounded-xl bg-muted p-4 text-sm">
              <Flag className="mt-0.5 size-4 shrink-0 text-accent" />
              <p>
                <span className="hidden md:inline">Name, icon, industry, founder name, target user and audience</span>
                <span className="md:hidden">Name, founder and audience</span> come from the product <strong>{product.name}</strong>.{" "}
                {f.variable === "logo" ? "This tests the logo instead of the product icon. " : null}
                {f.variable === "language" ? "This tests the card language. " : null}
                <Link href={`/products/${product.id}`} className="font-semibold underline">
                  Edit product
                </Link>
              </p>
            </div>

            {/* 3. Same on every card */}
            <Card className="p-5 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-lg md:text-xl">
                  <span className="hidden md:inline">3. </span>Same on every card
                </h2>
                <span className="hidden items-center gap-1.5 text-sm text-muted-foreground md:flex">
                  <Lock className="size-3.5" /> Locked while testing {TEST_VARIABLE_LABELS[f.variable].toLowerCase()}
                </span>
                <button type="button" className="text-sm font-semibold underline md:hidden" onClick={() => setEditingShared((v) => !v)} aria-expanded={editingShared}>
                  {editingShared ? "Done" : "Edit"}
                </button>
              </div>

              <div className={cn(editingShared && "hidden", "md:hidden")}>
                <ul className="divide-y divide-border">
                  {shownRows.length === 0 ? <li className="py-3 text-muted-foreground">Nothing filled in yet. Tap Edit.</li> : null}
                  {shownRows.map((r) => (
                    <li key={r.key} className="flex items-center justify-between gap-4 py-3">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Lock className="size-4" /> {r.label}
                      </span>
                      <span className="text-right font-bold">{r.value}</span>
                    </li>
                  ))}
                </ul>
                {moreLocked.length > 0 ? <p className="mt-2 text-muted-foreground">+ {moreLocked.length} more locked: {moreLocked.join(", ")}</p> : null}
              </div>

              <div className={cn(!editingShared && "hidden", "space-y-4 md:block")}>
                <div className="grid gap-4 md:grid-cols-2">
                  {!tested.includes("reward") ? (
                    <div>
                      <FieldLabel htmlFor="shared-reward" hint="Shown on the button">
                        Launch reward
                      </FieldLabel>
                      <TextInput id="shared-reward" value={f.reward} onChange={(e) => update({ reward: e.target.value })} placeholder="Get 3 months free at launch" maxLength={80} />
                      <ErrorText message={errorFor(errors, "shared.reward")} />
                    </div>
                  ) : null}
                  {!tested.includes("price") ? (
                    <div>
                      <FieldLabel htmlFor="shared-price">Price</FieldLabel>
                      <TextInput id="shared-price" value={f.price} onChange={(e) => update({ price: e.target.value })} placeholder="Rs 299 / mo" maxLength={40} />
                      <ErrorText message={errorFor(errors, "shared.price")} />
                    </div>
                  ) : null}
                </div>
                {!tested.includes("headline") ? (
                  <div>
                    <FieldLabel htmlFor="shared-headline">Headline</FieldLabel>
                    <TextInput id="shared-headline" value={f.headline} onChange={(e) => update({ headline: e.target.value })} placeholder="Stop chasing payments." maxLength={120} />
                    <ErrorText message={errorFor(errors, "shared.headline")} />
                  </div>
                ) : null}

                {f.variable !== "language" ? (
                  <div className="space-y-3 rounded-xl bg-muted p-4">
                    <p className="text-sm">
                      <strong>Swipe question</strong> <span className="text-muted-foreground">Shown under every card. Swipers pick one answer.</span>
                    </p>
                    <div>
                      <FieldLabel htmlFor="question">Question</FieldLabel>
                      <TextInput id="question" value={f.question} onChange={(e) => update({ question: e.target.value })} maxLength={120} />
                      <ErrorText message={errorFor(errors, "question")} />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <FieldLabel htmlFor="positive">
                          <span aria-hidden className="mr-1.5 inline-block size-2.5 rounded-full bg-accent" />
                          Positive answer
                        </FieldLabel>
                        <TextInput id="positive" value={f.positiveLabel} onChange={(e) => update({ positiveLabel: e.target.value })} maxLength={40} />
                        <ErrorText message={errorFor(errors, "positiveLabel")} />
                      </div>
                      <div>
                        <FieldLabel htmlFor="negative">
                          <span aria-hidden className="mr-1.5 inline-block size-2.5 rounded-full bg-[#a1a1aa]" />
                          Negative answer
                        </FieldLabel>
                        <TextInput id="negative" value={f.negativeLabel} onChange={(e) => update({ negativeLabel: e.target.value })} maxLength={40} />
                        <ErrorText message={errorFor(errors, "negativeLabel")} />
                      </div>
                    </div>
                  </div>
                ) : null}

                {!tested.includes("description") ? (
                  <div>
                    <FieldLabel htmlFor="shared-description">Description</FieldLabel>
                    <TextArea id="shared-description" value={f.description} onChange={(e) => update({ description: e.target.value })} placeholder="Say who bought on credit and Voice Khata records it…" maxLength={300} />
                    <ErrorText message={errorFor(errors, "shared.description")} />
                  </div>
                ) : null}

                {!tested.includes("productUI") ? (
                  <div>
                    <FieldLabel hint={`Optional · up to 5`}>Product UI</FieldLabel>
                    <ScreenshotSlots label="Product UI screenshots" images={f.productUI} onChange={(productUI) => update({ productUI })} onError={setUploadError} />
                    <ErrorText message={uploadError ?? errorFor(errors, "shared.productUI")} />
                  </div>
                ) : null}
              </div>
            </Card>

            {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

            <div className="space-y-3 md:hidden">
              <ActionButtons busy={busy} locked={locked} onDraft={() => submit(false)} onAi={() => setAiOpen(true)} onPublish={() => submit(true)} stacked />
              <p className="text-center text-sm text-muted-foreground">
                AI test is a preview only and never counts as real swipes.
              </p>
            </div>
          </div>

          {/* Live preview */}
          <aside className="space-y-3 md:sticky md:top-6" aria-label="Live preview">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-muted-foreground">Live preview · Version {VARIANT_KEYS[safePreview]}</p>
              <div className="flex gap-1.5" role="tablist" aria-label="Preview version">
                {f.versions.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={safePreview === i}
                    onClick={() => {
                      if (safePreview !== i) haptic("select");
                      setPreviewIndex(i);
                    }}
                    className={cn(
                      "pressable relative size-8 rounded-full bg-muted text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      safePreview === i ? "text-accent-foreground" : "text-muted-foreground",
                    )}
                  >
                    {safePreview === i ? (
                      <motion.span
                        layoutId="wizard-preview-tab"
                        aria-hidden
                        transition={reduceMotion ? { duration: 0 } : SPRING_SNAPPY}
                        className="absolute inset-0 rounded-full bg-accent"
                      />
                    ) : null}
                    <span className="relative">{VARIANT_KEYS[i]}</span>
                  </button>
                ))}
              </div>
            </div>
            {/* A quick fade when the version changes, so the switch reads as a switch. No exit wait. */}
            <motion.div
              key={safePreview}
              initial={reduceMotion ? false : { opacity: 0.35, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <CardPreview
                card={previewCard(f, safePreview)}
                productName={product.name}
                category={product.category}
                icon={product.icon || product.name.slice(0, 1)}
                accent={accentFor(product.name)}
                madeFor={product.targetUsers}
                founderLine={product.showOwnerName ? undefined : `The founder of ${product.name}`}
              />
            </motion.div>
          </aside>
        </div>
      </fieldset>

      {locked && message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      <AiPreviewSheet
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onEdit={() => setAiOpen(false)}
        onPublish={() => {
          setAiOpen(false);
          void submit(true);
        }}
      />
    </div>
  );
}

function ActionButtons({
  busy,
  locked,
  onDraft,
  onAi,
  onPublish,
  stacked,
}: {
  busy?: string;
  locked: boolean;
  onDraft: () => void;
  onAi: () => void;
  onPublish: () => void;
  stacked?: boolean;
}) {
  const disabled = locked || busy === "draft" || busy === "publish";
  return stacked ? (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-3">
        <Button variant="outline" size="lg" className="gap-1.5 px-2.5 text-[0.9375rem]" onClick={onDraft} disabled={disabled}>
          <Download /> {busy === "draft" ? "Saving…" : "Save draft"}
        </Button>
        <Button variant="outline" size="lg" className="gap-1.5 px-2.5 text-[0.9375rem]" onClick={onAi} disabled={locked}>
          <Sparkles className="text-accent" /> Test with AI personas
        </Button>
      </div>
      <Button size="lg" className="w-full" onClick={onPublish} disabled={disabled}>
        <Link2 /> {busy === "publish" ? "Publishing…" : "Publish test"}
      </Button>
    </>
  ) : (
    <>
      <Button variant="outline" onClick={onDraft} disabled={disabled}>
        {busy === "draft" ? "Saving…" : "Save draft"}
      </Button>
      <Button variant="outline" onClick={onAi} disabled={locked}>
        <Sparkles className="text-accent" /> Test with AI personas
      </Button>
      <Button onClick={onPublish} disabled={disabled}>
        <Link2 /> {busy === "publish" ? "Publishing…" : "Publish test"}
      </Button>
    </>
  );
}

/** Registers the breadcrumb with real names; renders nothing. */
function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  useBreadcrumb(items);
  return null;
}
