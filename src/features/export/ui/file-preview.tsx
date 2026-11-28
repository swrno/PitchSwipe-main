"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { columnLetter, toSheet, type SheetData } from "@/features/export/sheet";
import type { ExportFile, ExportScope } from "@/features/export/types";

import { fetchExportFile } from "./api";

type Entry = { kind: "pdf"; url: string } | { kind: "sheet"; sheet: SheetData } | { kind: "error"; message: string };

/** True from the md breakpoint up. The server render and first paint assume a phone. */
export function useIsWide(): boolean {
  return React.useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 768px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 768px)").matches,
    () => false,
  );
}

/**
 * The real file behind a tab: the PDF as an object URL or the CSV parsed into a sheet. Each file is fetched once
 * per (deck, scope, tab) while the dialog is open; changing scope drops the cache and revokes the PDF URLs.
 */
export function useFilePreview(deckId: string, scope: ExportScope, tab: ExportFile, skip: boolean): Entry | null {
  const [store, setStore] = React.useState<Record<string, Entry>>({});
  const session = React.useRef<object>({});
  const inflight = React.useRef<Set<string>>(new Set());
  const urls = React.useRef<Set<string>>(new Set());
  const key = `${deckId}|${scope}|${tab}`;

  React.useEffect(() => {
    const mine = {};
    session.current = mine;
    const owned = urls.current;
    const pending = inflight.current;
    return () => {
      session.current = {};
      pending.clear();
      owned.forEach((u) => URL.revokeObjectURL(u));
      owned.clear();
      setStore({});
    };
  }, [deckId, scope]);

  const cached = store[key];
  React.useEffect(() => {
    if (skip || cached || inflight.current.has(key)) return;
    const mine = session.current;
    inflight.current.add(key);
    const isPdf = tab === "report";
    fetchExportFile(deckId, scope, tab, isPdf ? undefined : "csv")
      .then(async (blob): Promise<Entry> => {
        if (isPdf) {
          const url = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: "application/pdf" }));
          if (session.current !== mine) {
            URL.revokeObjectURL(url);
            return { kind: "pdf", url: "" };
          }
          urls.current.add(url);
          return { kind: "pdf", url };
        }
        return { kind: "sheet", sheet: toSheet(await blob.text()) };
      })
      .catch((e: unknown): Entry => ({ kind: "error", message: e instanceof Error ? e.message : "Could not load the preview." }))
      .then((entry) => {
        if (session.current !== mine) return;
        inflight.current.delete(key);
        setStore((s) => ({ ...s, [key]: entry }));
      });
  }, [deckId, scope, tab, skip, key, cached]);

  return cached ?? null;
}

export function PreviewSkeleton({ label, className }: { label: string; className: string }) {
  return (
    <div role="status" className={`flex animate-pulse flex-col items-center justify-center gap-2 rounded-xl border border-border bg-muted text-sm text-muted-foreground ${className}`}>
      <Loader2 className="size-5 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function PreviewError({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-xl bg-warning-soft px-3 py-2 text-sm font-semibold text-warning">
      {message} You can still download.
    </p>
  );
}

export function PdfFrame({ url }: { url: string }) {
  return (
    <iframe
      title="PDF preview"
      src={`${url}#toolbar=0&navpanes=0&view=FitH`}
      className="h-full min-h-[320px] w-full flex-1 rounded-xl border border-border bg-white"
    />
  );
}

const CELL = "border-b border-r border-border px-2 py-0 h-6 whitespace-nowrap text-left align-middle";

/** Spreadsheet-style grid: column letters, row numbers, sticky headers, scrolls both ways. */
export function SheetGrid({ sheet, empty }: { sheet: SheetData; empty: string }) {
  if (sheet.rows.length === 0) return <p className="rounded-xl bg-muted px-3 py-3 text-sm text-muted-foreground">{empty}</p>;
  const [header, ...body] = sheet.rows;
  const cols = Array.from({ length: sheet.columns }, (_, i) => i);
  const shown = body.length;
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="min-h-[200px] flex-1 overflow-auto rounded-xl border border-border bg-background" tabIndex={0} role="region" aria-label="Spreadsheet preview">
        <table className="min-w-full border-separate border-spacing-0 font-mono text-xs tabular-nums">
          <thead>
            <tr>
              <th scope="col" className={`${CELL} sticky left-0 top-0 z-30 w-10 min-w-10 bg-muted`} />
              {cols.map((c) => (
                <th key={c} scope="col" className={`${CELL} sticky top-0 z-20 min-w-24 bg-muted text-center font-semibold text-muted-foreground`}>
                  {columnLetter(c)}
                </th>
              ))}
            </tr>
            <tr>
              <th scope="row" className={`${CELL} sticky left-0 top-6 z-30 bg-muted text-center font-semibold text-muted-foreground`}>
                1
              </th>
              {cols.map((c) => (
                <th key={c} scope="col" className={`${CELL} sticky top-6 z-20 bg-muted font-bold text-foreground`}>
                  {header[c] ?? ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((r, i) => (
              <tr key={i}>
                <th scope="row" className={`${CELL} sticky left-0 z-10 bg-muted text-center font-semibold text-muted-foreground`}>
                  {i + 2}
                </th>
                {cols.map((c) => (
                  <td key={c} title={r[c]} className={`${CELL} max-w-[20rem] truncate text-muted-foreground`}>
                    {r[c] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {sheet.total > shown ? `Showing ${shown} of ${sheet.total} rows. The file has every row.` : `${sheet.total} ${sheet.total === 1 ? "row" : "rows"}.`}
        {sheet.total === 0 && ` ${empty}`}
      </p>
    </div>
  );
}
