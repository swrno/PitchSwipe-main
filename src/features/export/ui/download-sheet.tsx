"use client";

import * as React from "react";
import { Check, Download, Loader2, X } from "lucide-react";

import { ModalSheet } from "@/features/claims/ui/modal-sheet";
import { cn } from "@/shared/lib/utils";
import { EXPORT_FILES, type ExportFile, type ExportScope } from "@/features/export/types";
import { LIMITS } from "@/shared/lib/limits";

import { downloadExport, emailExport, fetchExportOptions, type ExportOptions } from "./api";

const FILE_COPY: Record<ExportFile, { title: string; format: string; phone: string; web: string }> = {
  report: {
    title: "Results report",
    format: "PDF",
    phone: "Winner and chance each version is best, Swipers → Said yes → Joined waitlist for every version, who swiped, and AI insights. Ready to share with your team or investors.",
    web: "Winner and chance each version is best, Swipers → Said yes → Joined waitlist for every version, who swiped, and AI insights. Ready to share with your team or investors.",
  },
  summary: {
    title: "Summary table",
    format: "Excel · CSV",
    phone: "One row per version, split by state, source, interest and target user, with totals.",
    web: "One row per version, split by state, source, interest and target user, with totals.",
  },
  swipes: {
    title: "Every swipe",
    format: "CSV",
    phone: "One row per swipe: time, version, yes or no, comment, state, source, interest. Swipers stay anonymous.",
    web: "One row per swipe: time, version, yes or no, comment, state, source, interest. Swipers stay anonymous.",
  },
  waitlist: {
    title: "Waitlist emails",
    format: "CSV",
    phone: "Email, the version it came from and when it was claimed.",
    web: "Email, the version it came from and when it was claimed.",
  },
};

const DEFAULT_FILES: ExportFile[] = ["report", "summary", "waitlist"];

/** "18:20" in Indian time, the same clock the files are stamped with. */
function clockLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).format(d);
}

function FileCard({
  kind,
  checked,
  onChange,
  detail,
}: {
  kind: ExportFile;
  checked: boolean;
  onChange: (on: boolean) => void;
  detail: string;
}) {
  const copy = FILE_COPY[kind];
  return (
    <label
      className={cn(
        "relative flex cursor-pointer items-start gap-3 rounded-2xl border bg-background p-4 md:gap-3 md:rounded-xl md:px-3.5 md:py-3",
        checked ? "border-2 border-primary" : "border-border",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2",
      )}
    >
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border-2 md:size-5 md:rounded",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
        )}
      >
        {checked && <Check className="size-4 md:size-3.5" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="text-lg font-extrabold leading-tight tracking-tight md:text-base">{copy.title}</span>
          <span className="shrink-0 rounded-lg bg-muted px-2.5 py-1 text-sm font-bold text-muted-foreground md:px-2 md:py-0.5 md:text-xs">{copy.format}</span>
        </span>
        <span className="mt-1 block text-base leading-snug text-muted-foreground md:text-sm">{detail}</span>
      </span>
    </label>
  );
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

/**
 * Download results: bottom sheet on phone (designs phone 16), centred dialog on web (web 18).
 * Phone shows one black "Download N files" button; web adds "Email me the files".
 */
export function DownloadSheet({ deckId, onClose }: { deckId: string; onClose: () => void }) {
  const [options, setOptions] = React.useState<ExportOptions | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [scope, setScope] = React.useState<ExportScope>("deck");
  const [files, setFiles] = React.useState<ExportFile[]>(DEFAULT_FILES);
  const [busy, setBusy] = React.useState<"download" | "email" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [openedAt] = React.useState(() => new Date());

  React.useEffect(() => {
    let cancelled = false;
    fetchExportOptions(deckId)
      .then((o) => !cancelled && setOptions(o))
      .catch((e: unknown) => !cancelled && setLoadError(e instanceof Error ? e.message : "Could not load the download options."));
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  const toggle = (kind: ExportFile, on: boolean) => setFiles((cur) => EXPORT_FILES.filter((f) => (f === kind ? on : cur.includes(f))));
  const count = files.length;
  const plural = count === 1 ? "file" : "files";
  const waitlistText = options ? `${options.waitlistCount} ${options.waitlistCount === 1 ? "email" : "emails"}.` : "";

  async function run(kind: "download" | "email") {
    if (count === 0 || busy) return;
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      const choice = { deckId, scope, files };
      if (kind === "download") {
        await downloadExport(choice);
        onClose();
      } else {
        const out = await emailExport(choice);
        setNotice(`Sent to ${out.to}. Check your inbox.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const deckName = options?.deckLabel ?? "this deck";
  const productDecks = options?.productDecks ?? 1;

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

      <div className="flex flex-col gap-3 md:flex-row-reverse">
        <button
          type="button"
          onClick={() => run("download")}
          disabled={count === 0 || busy !== null}
          className="inline-flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-xl font-extrabold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 md:h-12 md:flex-1 md:rounded-xl md:text-base"
        >
          {busy === "download" ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Download className="size-5" aria-hidden />}
          {count === 0 ? "Pick a file" : `Download ${count} ${plural}`}
          {count > 1 && <span className="hidden md:inline">(.zip)</span>}
        </button>
        <button
          type="button"
          onClick={() => run("email")}
          disabled={count === 0 || busy !== null}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 md:h-12 md:flex-1 md:rounded-xl md:border md:border-border md:bg-background md:text-base md:font-extrabold"
        >
          {busy === "email" && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Email me the files
        </button>
      </div>
    </>
  );

  return (
    <ModalSheet labelledBy="download-results-title" onDismiss={onClose} footer={footer} className="md:max-w-[35rem]">
      <div className="mb-4 flex items-center justify-between gap-3 md:mb-5">
        <h2 id="download-results-title" className="text-3xl font-extrabold tracking-tight md:text-[1.75rem]">
          Download results
        </h2>
        <button type="button" onClick={onClose} className="text-lg font-bold text-muted-foreground hover:text-foreground md:hidden">
          Cancel
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="hidden size-10 items-center justify-center rounded-full bg-muted hover:bg-border md:flex"
        >
          <X className="size-5" />
        </button>
      </div>

      <p className="mb-2 hidden text-sm font-bold md:block">Include</p>
      <Segmented
        value={scope}
        onChange={setScope}
        options={[
          {
            value: "deck",
            label: (
              <>
                This deck<span className="hidden md:inline">: {deckName}</span>
              </>
            ),
          },
          {
            value: "product",
            label: (
              <>
                Whole product<span className="hidden md:inline">: {productDecks} {productDecks === 1 ? "deck" : "decks"}</span>
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

      <p className="mb-2 mt-4 hidden text-sm font-bold md:block">Files</p>
      <div className="mt-4 space-y-3 md:mt-0 md:space-y-2.5">
        {EXPORT_FILES.map((kind) => (
          <FileCard
            key={kind}
            kind={kind}
            checked={files.includes(kind)}
            onChange={(on) => toggle(kind, on)}
            detail={kind === "waitlist" && options ? `${FILE_COPY.waitlist.phone} ${waitlistText}` : FILE_COPY[kind].phone}
          />
        ))}
      </div>

      <p className="mt-4 text-base leading-snug text-muted-foreground md:text-sm">
        Numbers as of today, {clockLabel(openedAt)}. Groups with fewer than {LIMITS.groupMinSize} swipers are grouped as &quot;{LIMITS.otherLabel}&quot;, so no one can be identified.
      </p>

    </ModalSheet>
  );
}
