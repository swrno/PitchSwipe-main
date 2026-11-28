"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { IDEA_MAX, IDEA_MIN, looksLikeNewProduct, type IdeaDraft } from "@/features/decks/idea";
import { api, ApiError } from "./api";
import { PageHeader } from "@/shared/shell/page-header";
import { ErrorText, StepProgress, TextArea } from "./primitives";

export interface IdeaResult {
  draft: IdeaDraft;
  source: "ai" | "template";
  note?: string;
}

/** Step 0 of New deck: one textarea, Generate with AI, or skip to the empty wizard. */
export function IdeaStep({ onDrafted, onSkip }: { onDrafted: (r: IdeaResult) => void; onSkip: () => void }) {
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const length = text.trim().length;
  const ready = length >= IDEA_MIN && length <= IDEA_MAX;

  async function generate() {
    if (!ready || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      onDrafted(await api<IdeaResult>("/api/decks/idea", { method: "POST", body: { text } }));
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : "Could not draft this. Try again, or fill it in yourself.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader icon="newTest" title="New test" description="Describe your idea. AI drafts the pitch and you edit it before anything goes live." className="mb-0" />
      <StepProgress step={1} total={3} label="Describe your idea" />
      <Card className="space-y-4 p-5 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0">
        <div>
          <label htmlFor="idea-text" className="sr-only">
            About your product
          </label>
          <TextArea
            id="idea-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={IDEA_MAX}
            rows={8}
            disabled={busy}
            className="min-h-48 resize-y bg-card text-lg"
            placeholder="For example: A voice ledger for kirana shop owners. They speak each sale and it is written down for them, in Hindi."
            aria-describedby="idea-help"
          />
          <div id="idea-help" className="mt-1 flex justify-between text-sm text-muted-foreground">
            <span>{length < IDEA_MIN ? `At least ${IDEA_MIN} characters` : "Looks good"}</span>
            <span>
              {length} / {IDEA_MAX}
            </span>
          </div>
          <ErrorText message={error} />
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <Button size="lg" onClick={generate} disabled={!ready || busy} className="sm:min-w-52">
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} {busy ? "Drafting your pitch…" : "Generate with AI"}
          </Button>
          <button type="button" onClick={onSkip} disabled={busy} className="text-center text-sm font-semibold text-muted-foreground underline">
            Skip, fill it in myself
          </button>
        </div>
        <p className="text-sm text-muted-foreground" role="status">
          AI never invents prices or numbers. You still choose what to test.
        </p>
      </Card>
    </div>
  );
}

/** After drafting, when a product is already selected: add the test to it, or create a new product from the draft. */
export function ProductChoice({
  draft,
  current,
  busy,
  error,
  onUseCurrent,
  onCreate,
}: {
  draft: IdeaDraft;
  current: { name: string; industry: string };
  busy: boolean;
  error?: string;
  onUseCurrent: () => void;
  onCreate: () => void;
}) {
  const newName = draft.name || "New product";
  const [choice, setChoice] = React.useState<"current" | "new">(looksLikeNewProduct(draft, current) ? "new" : "current");
  const options = [
    { id: "current" as const, label: `Add this test to ${current.name}` },
    { id: "new" as const, label: `Create a new product: ${newName}` },
  ];
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader icon="newTest" title="Which product is this for?" description="Your draft looks like it may be a different product from the one selected." className="mb-0" />
      <Card className="space-y-4 p-5">
        <fieldset className="space-y-3" disabled={busy}>
          <legend className="sr-only">Product for this test</legend>
          {options.map((o) => (
            <label key={o.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-4 font-semibold has-[:checked]:border-primary">
              <input type="radio" name="idea-product" checked={choice === o.id} onChange={() => setChoice(o.id)} className="size-4" />
              {o.label}
            </label>
          ))}
        </fieldset>
        <ErrorText message={error} />
        <Button size="lg" disabled={busy} onClick={choice === "new" ? onCreate : onUseCurrent}>
          {busy ? <Loader2 className="animate-spin" /> : null} Continue
        </Button>
      </Card>
    </div>
  );
}
