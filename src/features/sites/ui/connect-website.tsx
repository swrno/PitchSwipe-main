"use client";

import { IconLabel } from "@/shared/ui/icon";
import * as React from "react";
import { Check, Code2, Copy, Loader2, Mail, RefreshCw, TriangleAlert } from "lucide-react";

import { assistantJson } from "@/features/assistant/ui/api";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { ModalSheet } from "@/features/claims/ui/modal-sheet";
import { agoLabel } from "@/features/sites/status";
import {
  buildFrameworkSetup,
  DEFAULT_FRAMEWORK,
  developerMessage,
  frameworkLabel,
  frameworkStorageKey,
  FRAMEWORKS,
  installCopyText,
  isFrameworkId,
  type CodeBlock as CodeBlockData,
  type FrameworkId,
  type FrameworkSetup,
} from "@/features/sites/frameworks";
import type { SiteRow, SiteView } from "@/features/sites/types";
import { cn } from "@/shared/lib/utils";

const POLL_MS = 10_000;

/**
 * F2b Connect website (web 05): "Ship winners to your website."
 * Three steps (snippet, mark elements, check the connection), what the site shows now, and what
 * approving does. On phones the same cards stack. Polls while the snippet has not been seen.
 */
export function ConnectWebsite({
  productId,
  initial,
}: {
  productId: string;
  /** Server-rendered data, when the page has it. */
  initial?: SiteView;
}) {
  const [view, setView] = React.useState<SiteView | null>(initial ?? null);
  const [error, setError] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(() => Date.now());
  const [editing, setEditing] = React.useState(false);
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const [framework, setFramework] = React.useState<FrameworkId>(DEFAULT_FRAMEWORK);

  React.useEffect(() => {
    // Remembered per product; read after mount so the server and first client render agree.
    try {
      const saved = localStorage.getItem(frameworkStorageKey(productId));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (isFrameworkId(saved)) setFramework(saved);
    } catch {
      /* storage unavailable: keep the default */
    }
  }, [productId]);

  const pickFramework = (id: FrameworkId) => {
    setFramework(id);
    try {
      localStorage.setItem(frameworkStorageKey(productId), id);
    } catch {
      /* ignore */
    }
  };
  const viewSetup = view?.setup ?? null;
  const setup = React.useMemo<FrameworkSetup | null>(() => {
    if (!viewSetup) return null;
    try {
      return buildFrameworkSetup(framework, viewSetup);
    } catch {
      return null;
    }
  }, [viewSetup, framework]);

  const load = React.useCallback(async () => {
    try {
      const v = await assistantJson<SiteView>("GET", `/api/sites?productId=${encodeURIComponent(productId)}`);
      setView(v);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [productId]);

  React.useEffect(() => {
    // Loads on mount; setState happens after the awaited fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const connected = view?.state === "connected";
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  React.useEffect(() => {
    if (!view?.site || connected) return;
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [view?.site, connected, load]);

  if (!view) {
    return (
      <div className="space-y-6">
        {error ? <p role="alert" className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">{error}</p> : <p className="text-sm text-muted-foreground" role="status">Loading your website settings...</p>}
      </div>
    );
  }

  const nowDate = new Date(now);
  const stepDone = [Boolean(view.site), view.elementsFound > 0, connected];

  return (
    <div className="space-y-6">
      {error ? <p role="alert" className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">{error}</p> : null}

      <Card className="p-5 md:p-5" aria-labelledby="your-site-h">
        <h2 id="your-site-h" className="text-lg font-semibold tracking-tight">
          <IconLabel icon="website">Your website</IconLabel>
        </h2>
        {view.site && !editing ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <a
              href={siteUrl(view.site.domain)}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 break-all text-2xl font-bold tracking-tight underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {view.site.domain}
            </a>
            <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium", connected ? "text-accent" : "text-muted-foreground")}>
              <span aria-hidden className={cn("size-2 rounded-full", connected ? "bg-accent" : "bg-muted-foreground")} />
              {connected ? "Snippet seen" : view.state === "element_not_found" ? "Snippet seen, no element found" : "Not seen yet"}
            </span>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="ml-auto">
              Change
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmRemove(true)} className="border-destructive text-destructive hover:bg-destructive/10">
              Remove
            </Button>
          </div>
        ) : (
          <AddressForm
            productId={productId}
            initial={view.site?.domain ?? ""}
            onDone={async () => {
              setEditing(false);
              await load();
            }}
            onCancel={view.site ? () => setEditing(false) : undefined}
          />
        )}
      </Card>
      {confirmRemove && view.site ? (
        <RemoveDialog
          productId={productId}
          domain={view.site.domain}
          onCancel={() => setConfirmRemove(false)}
          onDone={async () => {
            setConfirmRemove(false);
            setEditing(false);
            await load();
          }}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="p-5 md:p-5">
          {view.site ? <FrameworkPicker value={framework} onChange={pickFramework} /> : null}
          <Step done={stepDone[0]} n={1} title="Add this snippet to your site, once" disabled={!view.site}>
            {view.site ? <SnippetStep view={view} setup={setup} framework={framework} /> : <p className="text-sm text-muted-foreground">Save your website address above first.</p>}
          </Step>

          <Step done={stepDone[1]} n={2} title="Mark what each test controls" disabled={!view.site}>
            {setup ? (
              <>
                {setup.mark.intro.map((t) => (
                  <p key={t} className="text-sm text-muted-foreground">{t}</p>
                ))}
                {setup.mark.blocks.map((b) => (
                  <CodeBlock key={b.title ?? b.code} title={b.title}>{b.code}</CodeBlock>
                ))}
                {!view.setup?.flags.length ? <p className="mt-2 text-sm text-muted-foreground">Create a test to see its flag name here; this uses an example name.</p> : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Create a test to see its flag name here.</p>
            )}
          </Step>

          <Step done={stepDone[2]} n={3} title="Check the connection" last disabled={!view.site}>
            {view.site ? <ConnectionStatus view={view} now={nowDate} onCheck={load} /> : <p className="text-sm text-muted-foreground">Add your address first.</p>}
          </Step>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="@container p-5 md:p-5">
            <h2 className="text-lg font-semibold tracking-tight text-xl tracking-tight">What your site shows now</h2>
            {view.rows.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No text tests yet. Headline, description, reward and price tests appear here.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {view.rows.map((r) => (
                  <ShowingRow key={r.flagName} row={r} />
                ))}
              </ul>
            )}
            <p className="mt-4 text-sm text-muted-foreground">
              Your visitors see your current text until you approve a winner. Only swipers see the versions being tested.
            </p>
          </Card>

          <Card className="p-5 md:p-5">
            <h2 className="text-lg font-semibold tracking-tight text-xl tracking-tight">When you approve a winner</h2>
            <ol className="mt-4 space-y-3 text-sm">
              {[
                "The test ends.",
                "Your site shows the winning text within seconds, with no deploy.",
                "Undo puts your original text back (the test does not restart).",
              ].map((t, i) => (
                <li key={t} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">{i + 1}</span>
                  <span className="pt-0.5">{t}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Opens the saved address in a new tab; the stored domain may or may not carry a scheme. */
const siteUrl = (domain: string) => (/^https?:\/\//i.test(domain) ? domain : `https://${domain}`);

function Step({ n, done, title, children, last, disabled }: { n: number; done: boolean; title: string; children: React.ReactNode; last?: boolean; disabled?: boolean }) {
  return (
    <section className={cn("flex gap-4", !last && "pb-7", disabled && "opacity-60")} aria-label={title}>
      <span
        aria-label={done ? "Done" : `Step ${n}`}
        className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold", done ? "bg-accent text-accent-foreground" : "bg-muted text-foreground")}
      >
        {done ? <Check className="size-4" /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold tracking-tight text-lg font-bold">{title}</h2>
        <div className="mt-1">{children}</div>
      </div>
    </section>
  );
}

function FrameworkPicker({ value, onChange }: { value: FrameworkId; onChange: (id: FrameworkId) => void }) {
  return (
    <div className="mb-6">
      <label htmlFor="site-framework" className="text-sm font-medium">What is your site built with?</label>
      <div className="relative mt-2">
        <Code2 aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <select
          id="site-framework"
          value={value}
          onChange={(e) => onChange(e.target.value as FrameworkId)}
          className="h-12 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {FRAMEWORKS.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function RemoveDialog({ productId, domain, onCancel, onDone }: { productId: string; domain: string; onCancel: () => void; onDone: () => Promise<void> }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await assistantJson("DELETE", "/api/sites", { productId });
      await onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }
  return (
    <ModalSheet
      labelledBy="remove-site-h"
      onDismiss={busy ? undefined : onCancel}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button variant="destructive" onClick={remove} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : null} Remove
          </Button>
        </div>
      }
    >
      <h2 id="remove-site-h" className="text-lg font-semibold tracking-tight">Remove {domain}?</h2>
      <p className="mt-2 text-sm text-muted-foreground">The snippet stops showing winners on that site; your tests keep running.</p>
      {error ? <p role="alert" className="mt-2 text-sm text-warning">{error}</p> : null}
    </ModalSheet>
  );
}

function CodeBlock({ children, label, title }: { children: string; label?: string; title?: string }) {
  return (
    <div className="mt-3">
      {title ? <p className="mb-1 font-mono text-xs text-muted-foreground">{title}</p> : null}
      <CodeBlockPre label={label ?? title}>{children}</CodeBlockPre>
    </div>
  );
}

function CodeBlockPre({ children, label }: { children: string; label?: string }) {
  return (
    <pre
      tabIndex={0}
      aria-label={label}
      className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-ink p-4 font-mono text-[12.5px] leading-relaxed text-ink-foreground"
    >
      <code>{children}</code>
    </pre>
  );
}

function SnippetStep({ view, setup, framework }: { view: SiteView; setup: FrameworkSetup | null; framework: FrameworkId }) {
  const [copied, setCopied] = React.useState(false);
  const snippet = setup ? installCopyText(setup) : (view.snippet ?? "");

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = snippet;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // A mail draft in the founder's own mail app; nothing is sent from here and the snippet holds only the public key.
  const domain = view.site?.domain ?? "our site";
  const body = setup ? developerMessage(setup, domain) : `Hi,\n\nPlease paste this just before </body> on ${domain}. It only holds a public key.\n\n${snippet}\n\nThen mark the headline, price and reward with data-pitchswipe="<flag name>":\n\n${view.markup ?? ""}\n`;
  const mailto = `mailto:?subject=${encodeURIComponent(`Please add PitchSwipe to ${domain} (${frameworkLabel(framework)})`)}&body=${encodeURIComponent(body)}`;

  return (
    <>
      {setup ? (
        setup.install.intro.map((t) => (
          <p key={t} className="text-sm text-muted-foreground">{t}</p>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">Paste it before <code className="font-mono text-foreground">&lt;/body&gt;</code> on {view.site?.domain}.</p>
      )}
      {!view.keyConfigured ? (
        <p className="mt-2 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">
          Placeholder key: set NEXT_PUBLIC_FLAGSMITH_ENV_KEY to put your real public client key in this snippet.
        </p>
      ) : null}
      {setup ? (
        setup.install.blocks.map((b: CodeBlockData) => <CodeBlock key={b.title ?? b.code} title={b.title}>{b.code}</CodeBlock>)
      ) : (
        <CodeBlock label="Snippet">{snippet}</CodeBlock>
      )}
      <div className="mt-3 flex flex-wrap gap-3">
        <Button onClick={copy}>
          <Copy /> {copied ? "Copied" : "Copy snippet"}
        </Button>
        <a
          href={mailto}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background px-6 text-sm font-semibold hover:bg-muted"
        >
          <Mail className="size-4" /> Send to my developer
        </a>
      </div>
      <span className="sr-only" role="status" aria-live="polite">{copied ? "Snippet copied" : ""}</span>
    </>
  );
}

function AddressForm({ productId, initial, onDone, onCancel }: { productId: string; initial: string; onDone: () => Promise<void>; onCancel?: () => void }) {
  const [value, setValue] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await assistantJson("POST", "/api/sites", { productId, domain: value });
      await onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-1">
      <label htmlFor="site-domain" className="text-sm text-muted-foreground">
        Your website address, for example voice-khata.vercel.app
      </label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input
          id="site-domain"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="url"
          autoComplete="off"
          placeholder="your-site.com"
          className="h-12 flex-1 rounded-xl border border-input bg-background px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" disabled={busy || value.trim() === ""}>
          {busy ? <Loader2 className="animate-spin" /> : null} {initial ? "Save address" : "Get my snippet"}
        </Button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-warning">
          {error}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">Only this site can report back to PitchSwipe. Changing the address starts the check again.</p>
    </form>
  );
}

function ConnectionStatus({ view, now, onCheck }: { view: SiteView; now: Date; onCheck: () => Promise<void> }) {
  const [busy, setBusy] = React.useState(false);
  async function check() {
    setBusy(true);
    await onCheck();
    setBusy(false);
  }
  const ago = agoLabel(view.lastSeenAt, now);
  const domain = view.site?.domain ?? "";

  if (view.state === "connected") {
    return (
      <div role="status" className="rounded-xl bg-accent-soft px-4 py-3 text-sm">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span aria-hidden className="size-2.5 rounded-full bg-accent" />
          <strong className="font-bold">Connected: {domain}</strong>
          <span className="text-muted-foreground">
            · snippet seen {ago} · {view.elementsFound} element{view.elementsFound === 1 ? "" : "s"} found
          </span>
        </p>
        {view.missingFlags.length > 0 ? (
          <p className="mt-2 text-muted-foreground">
            Not marked yet: <span className="font-mono text-foreground">{view.missingFlags.join(", ")}</span>
          </p>
        ) : null}
      </div>
    );
  }

  const notFound = view.state === "element_not_found";
  return (
    <div role="status" className={cn("rounded-xl px-4 py-3 text-sm", notFound ? "bg-warning-soft" : "bg-muted")}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {notFound ? <TriangleAlert className="size-4 text-warning" aria-hidden /> : <span aria-hidden className="size-2.5 animate-pulse rounded-full bg-muted-foreground" />}
        <strong className="font-bold">{notFound ? `Snippet seen on ${domain}, but no element found` : `Waiting for the snippet on ${domain}`}</strong>
        {notFound ? <span className="text-muted-foreground">· seen {ago}</span> : null}
      </p>
      <p className="mt-2 text-muted-foreground">
        {notFound
          ? "Add data-pitchswipe=\"<flag name>\" to the headline, price or reward (step 2), then reload your site."
          : "Add the snippet, then open your site once. This page checks every few seconds."}
      </p>
      <Button variant="outline" size="sm" className="mt-3" onClick={check} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Check again
      </Button>
    </div>
  );
}

function ShowingRow({ row }: { row: SiteRow }) {
  return (
    <li className="grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-1 py-3 @md:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <p className="font-bold">{row.label}</p>
        <p className="break-all font-mono text-xs text-muted-foreground">{row.flagName}</p>
      </div>
      <p className="order-3 col-span-2 text-sm @md:order-none @md:col-span-1">
        {row.seen ? (
          <>
            Showing: <span className="text-muted-foreground">&quot;{row.showing}&quot;</span>
          </>
        ) : (
          <span className="text-muted-foreground">Not seen on your site yet</span>
        )}
      </p>
      <p className={cn("text-right text-sm font-bold", row.tone === "amber" && "text-warning", row.tone === "green" && "text-accent", row.tone === "grey" && "text-muted-foreground")}>{row.badge}</p>
    </li>
  );
}
