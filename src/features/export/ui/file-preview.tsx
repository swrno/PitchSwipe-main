"use client";

import * as React from "react";

import { columnLetter, toSheet, type SheetData } from "@/features/export/sheet";
import { cellCount, inRange, move, numericSum, rangeLabel, rangeOf, selectAll, selectColumn, selectRow, single, toTsv, type Move, type Selection } from "@/features/export/sheet-selection";
import type { ExportFile, ExportScope } from "@/features/export/types";

import { fetchExportFile } from "./api";
import { PreviewFrameSkeleton } from "@/shared/ui/page-skeletons";

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

export function PreviewSkeleton({ label, className, kind = "sheets" }: { label: string; className: string; kind?: "pdf" | "sheets" }) {
  return <PreviewFrameSkeleton kind={kind} label={label} className={className} />;
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

const CELL = "border-b border-r border-border px-2 py-0 h-6 whitespace-nowrap text-left align-middle scroll-ml-10 scroll-mt-12";
const TINT = "linear-gradient(color-mix(in oklab, var(--accent) 18%, transparent), color-mix(in oklab, var(--accent) 18%, transparent))";
const EDGE = (side: "top" | "bottom" | "left" | "right") =>
  ({ top: "inset 0 2px 0 0", bottom: "inset 0 -2px 0 0", left: "inset 2px 0 0 0", right: "inset -2px 0 0 0" })[side] + " var(--accent)";

/**
 * Spreadsheet-style grid: column letters, row numbers, sticky headers, scrolls both ways. Cells are selectable like
 * Excel / Google Sheets (click, drag, Shift+click, letters, row numbers, corner, arrows, Ctrl/Cmd+A, Ctrl/Cmd+C as TSV).
 * The selection maths lives in sheet-selection.ts.
 */
export function SheetGrid({
  sheet,
  empty,
  frameClassName = "min-h-[200px] flex-1",
  label = "Spreadsheet preview",
}: {
  sheet: SheetData;
  empty: string;
  frameClassName?: string;
  label?: string;
}) {
  const [sel, setSel] = React.useState<Selection | null>(null);
  const [note, setNote] = React.useState("");
  const dragging = React.useRef(false);
  const tableRef = React.useRef<HTMLTableElement>(null);
  const frameRef = React.useRef<HTMLDivElement>(null);

  const bounds = React.useMemo(() => ({ rows: sheet.rows.length, cols: sheet.columns }), [sheet.rows.length, sheet.columns]);

  React.useEffect(() => {
    const stop = () => {
      dragging.current = false;
    };
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, []);

  const [prevSheet, setPrevSheet] = React.useState(sheet);
  if (prevSheet !== sheet) {
    setPrevSheet(sheet);
    setSel(null);
  }

  React.useEffect(() => {
    if (!sel) return;
    tableRef.current?.querySelector(`[data-r="${sel.active.r}"][data-c="${sel.active.c}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [sel]);

  React.useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(""), 2000);
    return () => window.clearTimeout(t);
  }, [note]);

  if (sheet.rows.length === 0) return <p className="rounded-xl bg-muted px-3 py-3 text-sm text-muted-foreground">{empty}</p>;
  const header = sheet.rows[0];
  const body = sheet.rows.slice(1);
  const cols = Array.from({ length: sheet.columns }, (_, i) => i);
  const shown = body.length;
  const range = sel ? rangeOf(sel) : null;
  const activeCell = sel?.active;
  const sum = range ? numericSum(sheet.rows, range) : null;

  function press(e: React.MouseEvent, r: number, c: number) {
    if (e.button !== 0) return;
    dragging.current = true;
    setSel((s) => (e.shiftKey && s ? { anchor: s.anchor, active: { r, c } } : single({ r, c })));
    if (e.shiftKey) e.preventDefault();
    tableRef.current?.focus({ preventScroll: true });
  }
  function enter(r: number, c: number) {
    if (dragging.current) setSel((s) => (s ? { anchor: s.anchor, active: { r, c } } : s));
  }
  function onKeyDown(e: React.KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "a") {
      e.preventDefault();
      setSel(selectAll(bounds));
      return;
    }
    if (e.key === "Escape") {
      setSel((s) => (s ? single(s.active) : s));
      return;
    }
    const dir: Move | undefined = ({ ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", Home: "home", End: "end", PageUp: "pageUp", PageDown: "pageDown" } as const)[e.key as "ArrowUp"];
    if (!dir) return;
    e.preventDefault();
    const page = Math.max(1, Math.floor((frameRef.current?.clientHeight ?? 240) / 24) - 2);
    setSel((s) => move(s ?? single({ r: 0, c: 0 }), dir, bounds, e.shiftKey, page));
  }
  function onCopy(e: React.ClipboardEvent) {
    if (!range) return;
    e.preventDefault();
    e.clipboardData.setData("text/plain", toTsv(sheet.rows, range));
    const n = cellCount(range);
    setNote(`Copied ${n} ${n === 1 ? "cell" : "cells"}`);
  }

  function cellStyle(r: number, c: number): React.CSSProperties | undefined {
    if (!range || !inRange(range, r, c)) return undefined;
    const shadows: string[] = [];
    if (r === range.r0) shadows.push(EDGE("top"));
    if (r === range.r1) shadows.push(EDGE("bottom"));
    if (c === range.c0) shadows.push(EDGE("left"));
    if (c === range.c1) shadows.push(EDGE("right"));
    const multi = cellCount(range) > 1;
    return { backgroundImage: multi && !(activeCell?.r === r && activeCell.c === c) ? TINT : undefined, boxShadow: multi ? shadows.join(",") || undefined : EDGE("top") + "," + EDGE("bottom") + "," + EDGE("left") + "," + EDGE("right") };
  }
  const headSelected = (axis: "r" | "c", i: number) => (range ? (axis === "c" ? i >= range.c0 && i <= range.c1 : i >= range.r0 && i <= range.r1) : false);
  const headStyle = (on: boolean): React.CSSProperties | undefined => (on ? { backgroundImage: TINT } : undefined);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div ref={frameRef} className={`overflow-auto rounded-xl border border-border bg-background focus-within:ring-2 focus-within:ring-ring ${frameClassName}`} role="region" aria-label={label}>
        <table
          ref={tableRef}
          role="grid"
          tabIndex={0}
          aria-rowcount={sheet.rows.length}
          aria-colcount={sheet.columns}
          aria-multiselectable
          onKeyDown={onKeyDown}
          onCopy={onCopy}
          onFocus={() => setSel((s) => s ?? single({ r: 0, c: 0 }))}
          className="min-w-full select-none border-separate border-spacing-0 font-mono text-xs tabular-nums outline-none"
        >
          <thead>
            <tr>
              <th scope="col" aria-label="Select all" onMouseDown={() => { setSel(selectAll(bounds)); tableRef.current?.focus({ preventScroll: true }); }} className={`${CELL} sticky left-0 top-0 z-30 w-10 min-w-10 cursor-pointer bg-muted`} />
              {cols.map((c) => (
                <th key={c} scope="col" role="columnheader" onMouseDown={() => { setSel(selectColumn(c, bounds)); tableRef.current?.focus({ preventScroll: true }); }} style={headStyle(headSelected("c", c))} className={`${CELL} sticky top-0 z-20 min-w-24 cursor-pointer bg-muted text-center font-semibold text-muted-foreground`}>
                  {columnLetter(c)}
                </th>
              ))}
            </tr>
            <tr aria-rowindex={1}>
              <th scope="row" onMouseDown={() => { setSel(selectRow(0, bounds)); tableRef.current?.focus({ preventScroll: true }); }} style={headStyle(headSelected("r", 0))} className={`${CELL} sticky left-0 top-6 z-30 cursor-pointer bg-muted text-center font-semibold text-muted-foreground`}>
                1
              </th>
              {cols.map((c) => (
                <th key={c} data-r={0} data-c={c} role="gridcell" aria-selected={range ? inRange(range, 0, c) : false} onMouseDown={(e) => press(e, 0, c)} onMouseEnter={() => enter(0, c)} style={cellStyle(0, c)} className={`${CELL} sticky top-6 z-20 bg-muted font-bold text-foreground`}>
                  {header[c] ?? ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, i) => {
              const r = i + 1;
              return (
                <tr key={i} aria-rowindex={r + 1}>
                  <th scope="row" onMouseDown={() => { setSel(selectRow(r, bounds)); tableRef.current?.focus({ preventScroll: true }); }} style={headStyle(headSelected("r", r))} className={`${CELL} sticky left-0 z-10 cursor-pointer bg-muted text-center font-semibold text-muted-foreground`}>
                    {r + 1}
                  </th>
                  {cols.map((c) => (
                    <td key={c} data-r={r} data-c={c} role="gridcell" aria-selected={range ? inRange(range, r, c) : false} title={row[c]} onMouseDown={(e) => press(e, r, c)} onMouseEnter={() => enter(r, c)} style={cellStyle(r, c)} className={`${CELL} max-w-[20rem] truncate text-muted-foreground`}>
                      {row[c] ?? ""}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <p>
          {sheet.total > shown ? `Showing ${shown} of ${sheet.total} rows. The file has every row.` : `${sheet.total} ${sheet.total === 1 ? "row" : "rows"}.`}
          {sheet.total === 0 && ` ${empty}`}
        </p>
        <p className="tnum" aria-live="polite">
          {note ? (
            <span className="font-medium text-foreground">{note}</span>
          ) : range ? (
            <>
              {rangeLabel(range)} · {cellCount(range)} {cellCount(range) === 1 ? "cell" : "cells"}
              {sum !== null ? ` · Sum ${sum.toLocaleString("en-IN")}` : ""}
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}
