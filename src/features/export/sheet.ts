import { parseCsv } from "./csv";

export interface SheetData {
  /** Header row first, then data rows, cut to the row limit. */
  rows: string[][];
  /** Number of data rows in the file (header excluded). */
  total: number;
  /** Widest row, so the grid has the same number of columns everywhere. */
  columns: number;
}

/** Spreadsheet column name: 0 -> A, 25 -> Z, 26 -> AA. */
export function columnLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** Parses a CSV file's text for the preview grid: drops the BOM and blank lines, keeps the header plus `limit` data rows. */
export function toSheet(csv: string, limit = 200): SheetData {
  const all = parseCsv(csv.replace(/^﻿/, "")).filter((r) => r.some((c) => c !== ""));
  const total = Math.max(0, all.length - 1);
  const rows = all.slice(0, limit + 1);
  return { rows, total, columns: rows.reduce((m, r) => Math.max(m, r.length), 0) };
}
