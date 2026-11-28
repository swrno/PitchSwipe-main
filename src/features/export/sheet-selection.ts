import { columnLetter } from "./sheet";

/** Pure selection model for the spreadsheet grid (0-based row/column indexes; row 0 is the header row "1"). */
export interface Cell {
  r: number;
  c: number;
}
export interface Selection {
  /** Where the range started (fixed end). */
  anchor: Cell;
  /** The active cell and moving end of the range. */
  active: Cell;
}
export interface Range {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}
export interface Bounds {
  rows: number;
  cols: number;
}
export type Move = "up" | "down" | "left" | "right" | "home" | "end" | "pageUp" | "pageDown";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function single(cell: Cell): Selection {
  return { anchor: cell, active: cell };
}

/** Normalised rectangle covered by a selection. */
export function rangeOf(sel: Selection): Range {
  return {
    r0: Math.min(sel.anchor.r, sel.active.r),
    r1: Math.max(sel.anchor.r, sel.active.r),
    c0: Math.min(sel.anchor.c, sel.active.c),
    c1: Math.max(sel.anchor.c, sel.active.c),
  };
}

export function inRange(range: Range, r: number, c: number): boolean {
  return r >= range.r0 && r <= range.r1 && c >= range.c0 && c <= range.c1;
}

export function cellCount(range: Range): number {
  return (range.r1 - range.r0 + 1) * (range.c1 - range.c0 + 1);
}

export function selectAll(b: Bounds): Selection {
  return { anchor: { r: 0, c: 0 }, active: { r: Math.max(0, b.rows - 1), c: Math.max(0, b.cols - 1) } };
}

export function selectColumn(c: number, b: Bounds): Selection {
  return { anchor: { r: 0, c }, active: { r: Math.max(0, b.rows - 1), c } };
}

export function selectRow(r: number, b: Bounds): Selection {
  return { anchor: { r, c: 0 }, active: { r, c: Math.max(0, b.cols - 1) } };
}

/** Moves the active cell; `extend` keeps the anchor (Shift+arrow), otherwise the selection collapses to the new cell. */
export function move(sel: Selection, dir: Move, b: Bounds, extend: boolean, page = 10): Selection {
  const lastR = Math.max(0, b.rows - 1);
  const lastC = Math.max(0, b.cols - 1);
  let { r, c } = sel.active;
  switch (dir) {
    case "up": r -= 1; break;
    case "down": r += 1; break;
    case "left": c -= 1; break;
    case "right": c += 1; break;
    case "home": c = 0; break;
    case "end": c = lastC; break;
    case "pageUp": r -= page; break;
    case "pageDown": r += page; break;
  }
  const active = { r: clamp(r, 0, lastR), c: clamp(c, 0, lastC) };
  return { anchor: extend ? sel.anchor : active, active };
}

/** "B3" for one cell, "A2:C5" for a range, "B:B" style is not used: whole columns show as A1:A9. */
export function rangeLabel(range: Range): string {
  const a = `${columnLetter(range.c0)}${range.r0 + 1}`;
  const z = `${columnLetter(range.c1)}${range.r1 + 1}`;
  return a === z ? a : `${a}:${z}`;
}

function tsvCell(v: string): string {
  return /[\t\n\r"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Selection as tab-separated text (rows by newline), the format Excel and Google Sheets paste as cells. */
export function toTsv(rows: readonly (readonly string[])[], range: Range): string {
  const lines: string[] = [];
  for (let r = range.r0; r <= range.r1; r++) {
    const cells: string[] = [];
    for (let c = range.c0; c <= range.c1; c++) cells.push(tsvCell(rows[r]?.[c] ?? ""));
    lines.push(cells.join("\t"));
  }
  return lines.join("\n");
}

/** Sum of the numeric cells in the range, or null when none are numeric (thousands commas allowed). */
export function numericSum(rows: readonly (readonly string[])[], range: Range): number | null {
  let sum = 0;
  let found = false;
  for (let r = range.r0; r <= range.r1; r++) {
    for (let c = range.c0; c <= range.c1; c++) {
      const raw = (rows[r]?.[c] ?? "").trim().replace(/,/g, "");
      if (raw !== "" && /^-?\d+(\.\d+)?$/.test(raw)) {
        sum += Number(raw);
        found = true;
      }
    }
  }
  return found ? sum : null;
}
