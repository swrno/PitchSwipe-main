"use client";

import * as React from "react";
import { ChevronDown, Download, Loader2, X } from "lucide-react";

import { ModalSheet } from "@/features/claims/ui/modal-sheet";
import type { ExportPreview, PdfPreview } from "@/features/export/preview";
import { EXPORT_FILES, type ExportFile, type ExportScope } from "@/features/export/types";
import { cn } from "@/shared/lib/utils";
import { LIMITS } from "@/shared/lib/limits";
import { Badge } from "@/shared/ui/badge";
import { Icon, type IconName } from "@/shared/ui/icon";

import { PdfFrame, PreviewError, PreviewSkeleton, SheetGrid, useFilePreview, useIsWide } from "./file-preview";
import { downloadExport, fetchExportOptions, fetchExportPreview, type ExportChoice, type ExportOptions } from "./api";

/** The dialog's tabs are named after the app's test tabs. Each one previews (and mainly downloads) one file. */
export type TabId = "results" | "audience" | "waitlist";

const TABS: { id: TabId; label: string; icon: IconName; blurb: string; privacy?: string; button: string; file: ExportFile }[] = [
  {
    id: "results",
    label: "Results",
    icon: "results",
    blurb: "A ready-made report to share, plus every answer for your own analysis",
    button: "Download report (PDF)",
    file: "report",
  },
  {
    id: "audience",
    label: "Audience & who swiped",
    icon: "whoSwiped",
    blurb: "Each version's numbers, split by state, role, interest and source",
    privacy: `The Excel download has the same data with formatting. Groups with fewer than ${LIMITS.groupMinSize} swipers are grouped as "${LIMITS.otherLabel}", so no one can be identified.`,
    button: "Download table (Excel)",
    file: "summary",
  },
  {
    id: "waitlist",
    label: "Waitlist users",
    icon: "waitlist",
    blurb: "Everyone who joined the waitlist, with the version and date",
    privacy: "These are real email addresses, the same as in the file. Keep it private.",
    button: "Download emails (CSV)",
    file: "waitlist",
  },
];

const TAB_KEY = "pitchswipe.downloadTab";
const OLD_TAB_IDS: Record<string, TabId> = { report: "results", swipes: "results", summary: "audience", waitlist: "waitlist" };

/** The remembered tab. Ids from the old file-named tabs are migrated. */
function readTab(): TabId {
  try {
    const v = window.localStorage.getItem(TAB_KEY);
    if (v && TABS.some((t) => t.id === v)) return v as TabId;
    if (v && OLD_TAB_IDS[v]) return OLD_TAB_IDS[v];
  } catch {
    /* storage blocked: use the default */
  }
  return "results";
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: ExportScope;
  onChange: (v: ExportScope) => void;
  options: { value: ExportScope; label: React.ReactNode }[];
}) {
  return (
    <div role="group" aria-label="What to include" className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1 md:rounded-xl">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-11 rounded-xl px-3 text-base font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10 md:rounded-lg md:text-sm",
            value === o.value ? "bg-background text-foreground " : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Mini mock of page 1 of the PDF, drawn from the same numbers. */
function PdfMock({ pdf, stamp }: { pdf: PdfPreview; stamp: string }) {
  const funnel = [
    { label: "Swipers", n: pdf.swipers, pct: 100 },
    { label: "Said yes", n: pdf.saidYes, pct: pdf.swipers ? (pdf.saidYes / pdf.swipers) * 100 : 0 },
    { label: "Joined waitlist", n: pdf.joined, pct: pdf.swipers ? (pdf.joined / pdf.swipers) * 100 : 0 },
  ];
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <div
        role="img"
        aria-label={`Page 1 of the PDF: ${pdf.testLabel}, ${pdf.swipers} swipers, ${pdf.saidYes} said yes, ${pdf.joined} joined the waitlist`}
        className="w-full max-w-[17rem] shrink-0 self-center overflow-hidden rounded-lg border border-border bg-white text-[#111] shadow-sm sm:self-start"
      >
        <div className="bg-[#3b7a0c] px-3 py-2.5 text-white">
          <p className="text-[8px] font-bold tracking-widest opacity-80">PITCHSWIPE</p>
          <p className="text-[15px] font-extrabold leading-tight">Results report</p>
          <p className="mt-0.5 truncate text-[8px] opacity-90">
            {pdf.productName} · numbers as of {stamp}
          </p>
        </div>
        <div className="space-y-2 p-3">
          <div>
            <p className="truncate text-[7px] font-bold uppercase tracking-wider text-[#666]">{pdf.productName}</p>
            <p className="truncate text-[13px] font-extrabold leading-tight">{pdf.testLabel}</p>
            <p className="mt-0.5 line-clamp-2 text-[9px] font-bold leading-snug">{pdf.headline}</p>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              ["Swipers", pdf.swipers, null],
              ["Said yes", pdf.saidYes, pdf.saidYesPct],
              ["Joined", pdf.joined, pdf.joinedPct],
            ].map(([label, n, pct]) => (
              <div key={String(label)} className="rounded-md border border-[#e5e5e5] p-1.5">
                <p className="text-[6px] font-bold uppercase tracking-wider text-[#666]">{label}</p>
                <p className="text-[15px] font-extrabold leading-none">{n}</p>
                {pct !== null && <p className="text-[7px] text-[#666]">{pct}%</p>}
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <p className="text-[8px] font-extrabold">Funnel</p>
            {funnel.map((f) => (
              <div key={f.label} className="flex items-center gap-1.5">
                <span className="w-14 shrink-0 text-[7px] font-bold">{f.label}</span>
                <span className="h-2 flex-1 rounded-sm bg-[#eee]">
                  <span className="block h-2 rounded-sm bg-[#3b7a0c]" style={{ width: `${Math.max(f.pct, f.n > 0 ? 4 : 0)}%` }} />
                </span>
                <span className="w-5 text-right text-[7px] font-bold">{f.n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1.5 text-sm font-bold">Inside the PDF</p>
        <ol className="space-y-1 text-sm text-muted-foreground">
          {pdf.sections.map((s, i) => (
            <li key={s} className="flex gap-2">
              <span className="w-4 shrink-0 text-right font-bold text-foreground">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

interface MenuItem {
  id: string;
  label: string;
  onSelect: () => void;
  /** Why the item is off; shown under it and read out as its description. */
  disabledReason?: string;
  /** Shows the shared "Coming soon" badge next to the label. */
  coming?: boolean;
}

/**
 * One split button: the main part downloads the active tab's file; the chevron opens a small menu with the
 * other ways out. Menu button pattern: aria-haspopup="menu", arrow keys, Home/End, Escape (closes the menu only).
 */
function SplitDownload({
  label,
  busy,
  loading,
  onMain,
  items,
}: {
  label: string;
  busy: boolean;
  loading: boolean;
  onMain: () => void;
  items: MenuItem[];
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const chevronRef = React.useRef<HTMLButtonElement>(null);
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = React.useId();

  const focusItem = (i: number) => {
    const n = items.length;
    itemRefs.current[((i % n) + n) % n]?.focus();
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) chevronRef.current?.focus();
  };

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  React.useEffect(() => {
    if (open) focusItem(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- focus the first item once, when the menu opens
  }, [open]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    const at = itemRefs.current.findIndex((el) => el === document.activeElement);
    if (e.key === "Escape") {
      e.preventDefault();
      e.nativeEvent.stopPropagation(); // close the menu, not the dialog
      close(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(at + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(at - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusItem(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusItem(items.length - 1);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        onClick={onMain}
        disabled={busy}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-l-xl bg-primary px-5 text-base font-extrabold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
      >
        {loading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Download className="size-5" aria-hidden />}
        {label}
      </button>
      <button
        ref={chevronRef}
        type="button"
        aria-label="More download options"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="inline-flex h-12 w-11 items-center justify-center rounded-r-xl border-l border-primary-foreground/30 bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
      >
        <ChevronDown className={cn("size-5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Download options"
          onKeyDown={onMenuKey}
          className="absolute bottom-full right-0 z-10 mb-2 w-72 overflow-hidden rounded-xl border border-border bg-card py-1 text-card-foreground shadow-lg"
        >
          {items.map((it, i) => (
            <button
              key={it.id}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              aria-disabled={it.disabledReason ? true : undefined}
              aria-describedby={it.disabledReason ? `${menuId}-${it.id}-why` : undefined}
              title={it.disabledReason}
              tabIndex={-1}
              onClick={() => {
                if (it.disabledReason) return;
                close(false);
                it.onSelect();
              }}
              className={cn(
                "flex w-full flex-col items-start px-4 py-2.5 text-left text-sm font-semibold focus-visible:bg-muted focus-visible:outline-none",
                it.disabledReason ? "cursor-not-allowed text-muted-foreground" : "hover:bg-muted",
              )}
            >
              <span className="flex items-center gap-2">
                {it.label}
                {it.coming && <Badge variant="coming">Coming soon</Badge>}
              </span>
              {it.disabledReason && (
                <span id={`${menuId}-${it.id}-why`} className="mt-0.5 text-xs font-normal">
                  {it.disabledReason}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Download results: full-screen sheet on phone, centred dialog on web. One tab per file, each with a
 * short purpose and a preview of what is inside. One split download button sits in the footer.
 */
export function DownloadSheet({
  deckId,
  onClose,
  initialTab,
  initialScope = "deck",
}: {
  deckId: string;
  onClose: () => void;
  /** The tab to open on (the page it was opened from decides); the last used tab when omitted. */
  initialTab?: TabId;
  initialScope?: ExportScope;
}) {
  const [options, setOptions] = React.useState<ExportOptions | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [scope, setScope] = React.useState<ExportScope>(initialScope);
  const [tab, setTab] = React.useState<TabId>(initialTab ?? "results");
  // Results tab: the report, or the every-answer sheet below it.
  const [answers, setAnswers] = React.useState(false);
  const [preview, setPreview] = React.useState<ExportPreview | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const wide = useIsWide();
  const tabFile = (TABS.find((t) => t.id === tab) ?? TABS[0]).file;
  const shown: ExportFile = tab === "results" && answers ? "swipes" : tabFile;
  const file = useFilePreview(deckId, scope, shown, shown === "report" && !wide);
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  React.useEffect(() => {
    if (initialTab) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage exists only on the client
    setTab(readTab());
  }, [initialTab]);

  React.useEffect(() => {
    let cancelled = false;
    fetchExportOptions(deckId)
      .then((o) => !cancelled && setOptions(o))
      .catch((e: unknown) => !cancelled && setLoadError(e instanceof Error ? e.message : "Could not load the download options."));
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  React.useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the spinner while the new scope loads
    setPreview(null);
    setPreviewError(null);
    fetchExportPreview(deckId, scope)
      .then((p) => !cancelled && setPreview(p))
      .catch((e: unknown) => !cancelled && setPreviewError(e instanceof Error ? e.message : "Could not load the preview."));
    return () => {
      cancelled = true;
    };
  }, [deckId, scope]);

  function pick(id: TabId, focus = false) {
    setTab(id);
    if (initialTab) {
      if (focus) tabRefs.current[id]?.focus();
      return;
    }
    try {
      window.localStorage.setItem(TAB_KEY, id);
    } catch {
      /* ignore */
    }
    if (focus) tabRefs.current[id]?.focus();
  }

  function onTabKey(e: React.KeyboardEvent, index: number) {
    const last = TABS.length - 1;
    const next = e.key === "ArrowRight" ? (index === last ? 0 : index + 1) : e.key === "ArrowLeft" ? (index === 0 ? last : index - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (next === null) return;
    e.preventDefault();
    pick(TABS[next].id, true);
  }

  async function run(key: string, task: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const save = (files: ExportFile[], format?: "xlsx" | "csv", key = files.join()) =>
    run(key, async () => {
      const choice: ExportChoice = { deckId, scope, files, ...(format ? { format } : {}) };
      await downloadExport(choice);
    });
  const everything = () =>
    run("zip", async () => {
      await downloadExport({ deckId, scope, files: [...EXPORT_FILES] });
      onClose();
    });
  const deckName = options?.deckLabel ?? "this test";
  const productDecks = options?.productDecks ?? 1;
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

  const main = () => save([active.file], active.file === "summary" ? "xlsx" : undefined);
  const menuItems: MenuItem[] = [
    ...(active.id === "results" ? [{ id: "answers", label: "Download all answers (CSV)", onSelect: () => void save(["swipes"]) }] : []),
    ...(active.id === "audience" ? [{ id: "csv", label: "Download as CSV", onSelect: () => void save(["summary"], "csv", "summary-csv") }] : []),
    { id: "zip", label: "Download all files (.zip)", onSelect: () => void everything() },
    { id: "email", label: "Email me the files", onSelect: () => undefined, coming: true, disabledReason: "Email delivery is coming soon. Download the files instead." },
  ];

  const footer = (
    <>
      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-warning-soft px-3 py-2 text-sm font-semibold text-warning">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mb-3 rounded-xl bg-accent-soft px-3 py-2 text-sm font-semibold text-accent">
          {notice}
        </p>
      )}
      <div className="flex justify-end">
        <SplitDownload label={active.button} busy={busy !== null} loading={busy !== null} onMain={() => void main()} items={menuItems} />
      </div>
    </>
  );

  const emptyText = shown === "waitlist" ? "No one has joined the waitlist yet. The file will only have its header." : shown === "swipes" ? "No counted swipes yet." : "No versions yet.";

  return (
    <ModalSheet
      labelledBy="download-results-title"
      onDismiss={onClose}
      footer={footer}
      scroll={false}
      className="max-md:h-dvh max-md:max-h-none max-md:rounded-none md:h-[min(860px,92dvh)] md:max-w-6xl"
    >
      <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
        <h2 id="download-results-title" className="text-2xl font-extrabold tracking-tight md:text-[1.75rem]">
          Download results
        </h2>
        <button type="button" onClick={onClose} aria-label="Close" className="flex size-10 items-center justify-center rounded-full bg-muted hover:bg-border">
          <X className="size-5" />
        </button>
      </div>

      <Segmented
        value={scope}
        onChange={setScope}
        options={[
          {
            value: "deck",
            label: (
              <>
                This test<span className="hidden md:inline">: {deckName}</span>
              </>
            ),
          },
          {
            value: "product",
            label: (
              <>
                Whole product<span className="hidden md:inline">: {productDecks} {productDecks === 1 ? "test" : "tests"}</span>
              </>
            ),
          },
        ]}
      />

      {loadError && (
        <p role="alert" className="mt-4 rounded-xl bg-warning-soft px-3 py-2 text-sm font-semibold text-warning">
          {loadError}
        </p>
      )}

      <div role="tablist" aria-label="Files" className="-mx-5 mt-4 flex shrink-0 gap-1 overflow-x-auto border-b border-border px-5 md:mx-0 md:px-0">
        {TABS.map((t, i) => {
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={`dl-tab-${t.id}`}
              aria-selected={on}
              aria-controls="dl-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => pick(t.id)}
              onKeyDown={(e) => onTabKey(e, i)}
              className={cn(
                "-mb-px flex min-h-11 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                on ? "border-accent font-bold text-foreground" : "border-transparent font-medium text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon icon={t.icon} active={on} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id="dl-panel" aria-labelledby={`dl-tab-${active.id}`} tabIndex={0} className="mt-4 flex min-h-0 flex-1 flex-col gap-3 outline-none lg:grid lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] lg:grid-rows-1 lg:gap-6">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto" aria-live="polite">
          {tab === "results" && (
            <div role="group" aria-label="Preview" className="mb-3 inline-flex shrink-0 self-start rounded-xl bg-muted p-1">
              {([[false, "Report (PDF)"], [true, "All answers (CSV)"]] as const).map(([v, l]) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={answers === v}
                  onClick={() => setAnswers(v)}
                  className={cn(
                    "h-9 rounded-lg px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    answers === v ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
          {shown === "report" ? (
            !wide ? (
              previewError ? (
                <PreviewError message={previewError} />
              ) : !preview ? (
                <PreviewSkeleton label="Loading preview" className="h-40" />
              ) : (
                <PdfMock pdf={preview.pdf} stamp={preview.stamp} />
              )
            ) : !file ? (
              <PreviewSkeleton label="Loading the PDF" className="h-full flex-1" />
            ) : file.kind === "error" ? (
              <PreviewError message={file.message} />
            ) : file.kind === "pdf" ? (
              <PdfFrame url={file.url} />
            ) : null
          ) : !file ? (
            <PreviewSkeleton label="Loading the file" className="h-full flex-1" />
          ) : file.kind === "error" ? (
            <PreviewError message={file.message} />
          ) : file.kind === "sheet" ? (
            <SheetGrid sheet={file.sheet} empty={emptyText} />
          ) : null}
        </div>

        <div className="min-w-0 shrink-0 overflow-y-auto lg:min-h-0">
          <p className="text-base leading-snug md:text-sm">{active.blurb}</p>

          {shown === "report" && wide && preview && (
            <>
              <p className="mb-1.5 mt-4 text-sm font-bold">Inside</p>
              <ol className="space-y-1 text-sm text-muted-foreground">
                {preview.pdf.sections.map((s, i) => (
                  <li key={s} className="flex gap-2">
                    <span className="w-4 shrink-0 text-right font-bold text-foreground">{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
          {file?.kind === "sheet" && file.sheet.rows[0] && (
            <>
              <p className="mb-1.5 mt-4 text-sm font-bold">Inside</p>
              <ul className="flex flex-wrap gap-1.5">
                {file.sheet.rows[0].map((h, i) => (
                  <li key={i} className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {h}
                  </li>
                ))}
              </ul>
            </>
          )}

          {shown === "swipes" && <p className="mt-3 text-xs leading-snug text-muted-foreground">Swipers stay anonymous: no names, emails or IP addresses, and the time is cut to the minute.</p>}
          {active.privacy && <p className="mt-3 text-xs leading-snug text-muted-foreground">{active.privacy}</p>}
          {preview && <p className="mt-1 text-xs text-muted-foreground">Numbers as of {preview.stamp}.</p>}

        </div>
      </div>
    </ModalSheet>
  );
}
