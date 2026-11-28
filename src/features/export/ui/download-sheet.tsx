"use client";

import * as React from "react";
import { Download, Loader2, X } from "lucide-react";

import { ModalSheet } from "@/features/claims/ui/modal-sheet";
import type { ExportPreview, PdfPreview, TablePreview } from "@/features/export/preview";
import { EXPORT_FILES, type ExportFile, type ExportScope } from "@/features/export/types";
import { cn } from "@/shared/lib/utils";
import { LIMITS } from "@/shared/lib/limits";
import { Icon, type IconName } from "@/shared/ui/icon";

import { downloadExport, emailExport, fetchExportOptions, fetchExportPreview, type ExportChoice, type ExportOptions } from "./api";

type TabId = ExportFile;

const TABS: { id: TabId; label: string; icon: IconName; blurb: string; privacy?: string; button: string }[] = [
  {
    id: "report",
    label: "PDF report",
    icon: "results",
    blurb: "A designed report to share with your team or investors: the winner, the funnel and who swiped.",
    button: "Download PDF",
  },
  {
    id: "summary",
    label: "Spreadsheet",
    icon: "leaderboard",
    blurb: "One row per version with the totals, to sort, chart or paste into your own sheet.",
    privacy: `Groups with fewer than ${LIMITS.groupMinSize} swipers are grouped as "${LIMITS.otherLabel}", so no one can be identified.`,
    button: "Download Excel",
  },
  {
    id: "swipes",
    label: "Every swipe",
    icon: "swipe",
    blurb: "One row per swipe, for your own analysis. Handy for finding patterns in the comments.",
    privacy: "Swipers stay anonymous: no names, emails or IP addresses, and the time is cut to the minute.",
    button: "Download CSV",
  },
  {
    id: "waitlist",
    label: "Waitlist emails",
    icon: "waitlist",
    blurb: "The people who joined your waitlist, so you can email them when you launch.",
    privacy: "These are real email addresses, shown partly hidden here. Keep the file private.",
    button: "Download CSV",
  },
];

const TAB_KEY = "pitchswipe.downloadTab";

function readTab(): TabId {
  try {
    const v = window.localStorage.getItem(TAB_KEY);
    if (v && (EXPORT_FILES as readonly string[]).includes(v)) return v as TabId;
  } catch {
    /* storage blocked: use the default */
  }
  return "report";
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

function TableMock({ table, empty }: { table: TablePreview; empty: string }) {
  if (table.total === 0) return <p className="rounded-xl bg-muted px-3 py-3 text-sm text-muted-foreground">{empty}</p>;
  const shown = table.rows.length;
  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-max border-collapse text-left text-xs">
          <thead>
            <tr className="bg-muted">
              {table.header.map((h) => (
                <th key={h} scope="col" className="whitespace-nowrap px-2.5 py-1.5 font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                {r.map((c, j) => (
                  <td key={j} className="max-w-[14rem] truncate whitespace-nowrap px-2.5 py-1.5 text-muted-foreground">
                    {c || "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        First {shown} of {table.total} {table.unit}
        {table.total === 1 ? "" : "s"}. The file has every row.
      </p>
    </div>
  );
}

/**
 * Download results: full-screen sheet on phone, centred dialog on web. One tab per file, each with a
 * short purpose, a preview of what is inside and its own download button.
 */
export function DownloadSheet({ deckId, onClose }: { deckId: string; onClose: () => void }) {
  const [options, setOptions] = React.useState<ExportOptions | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [scope, setScope] = React.useState<ExportScope>("deck");
  const [tab, setTab] = React.useState<TabId>("report");
  const [preview, setPreview] = React.useState<ExportPreview | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage exists only on the client
    setTab(readTab());
  }, []);

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
  const email = () =>
    run("email", async () => {
      const out = await emailExport({ deckId, scope, files: [...EXPORT_FILES] });
      setNotice(`Sent to ${out.to}. Check your inbox.`);
    });

  const deckName = options?.deckLabel ?? "this test";
  const productDecks = options?.productDecks ?? 1;
  const emailOff = options !== null && !options.emailAvailable;
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

  const primary =
    "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-base font-extrabold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50";
  const secondary =
    "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-bold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

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
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={everything} disabled={busy !== null} className={secondary}>
          {busy === "zip" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
          Download everything (.zip)
        </button>
        <button type="button" onClick={email} disabled={busy !== null || emailOff} className={secondary}>
          {busy === "email" && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Email me the files
        </button>
      </div>
      {emailOff && <p className="mt-2 text-xs text-muted-foreground">Email is not set up yet. Download the files instead.</p>}
    </>
  );

  const table = preview && (tab === "summary" ? preview.summary : tab === "swipes" ? preview.swipes : tab === "waitlist" ? preview.waitlist : null);
  const emptyText = tab === "waitlist" ? "No one has joined the waitlist yet. The file will only have its header." : tab === "swipes" ? "No counted swipes yet." : "No versions yet.";

  return (
    <ModalSheet
      labelledBy="download-results-title"
      onDismiss={onClose}
      footer={footer}
      className="max-md:h-dvh max-md:max-h-none max-md:rounded-none md:max-w-[40rem]"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
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

      <div role="tablist" aria-label="Files" className="-mx-5 mt-4 flex gap-1 overflow-x-auto border-b border-border px-5 md:mx-0 md:px-0">
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

      <div role="tabpanel" id="dl-panel" aria-labelledby={`dl-tab-${active.id}`} tabIndex={0} className="mt-4 outline-none">
        <p className="text-base leading-snug md:text-sm">{active.blurb}</p>

        <div className="mt-4 min-h-40" aria-live="polite">
          {previewError ? (
            <p role="alert" className="rounded-xl bg-warning-soft px-3 py-2 text-sm font-semibold text-warning">
              {previewError} You can still download.
            </p>
          ) : !preview ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Loading preview
            </p>
          ) : tab === "report" ? (
            <PdfMock pdf={preview.pdf} stamp={preview.stamp} />
          ) : table ? (
            <TableMock table={table} empty={emptyText} />
          ) : null}
        </div>

        {active.privacy && <p className="mt-3 text-xs leading-snug text-muted-foreground">{active.privacy}</p>}
        {preview && <p className="mt-1 text-xs text-muted-foreground">Numbers as of {preview.stamp}.</p>}

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => save([active.id], active.id === "summary" ? "xlsx" : undefined)}
            className={cn(primary, "w-full sm:w-auto")}
          >
            {busy === active.id ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Download className="size-5" aria-hidden />}
            {active.button}
          </button>
          {active.id === "summary" && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => save(["summary"], "csv", "summary-csv")}
              className="text-sm font-bold underline underline-offset-2 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              or download CSV
            </button>
          )}
        </div>
      </div>
    </ModalSheet>
  );
}
