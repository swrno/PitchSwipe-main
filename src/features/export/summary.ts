/**
 * Summary table (xlsx + csv). Pure. Built from the WP7 payload, so every number, the
 * under-10 "Other" rule and the Result / Lead tags match what the founder sees on screen.
 *
 * Sheet "Versions": one row per version with its source and target-user split, then totals.
 * Sheet "Segments": state, source, interest and target-user groups, always tagged Lead.
 */
import { LIMITS } from "@/shared/lib/limits";
import type { SegmentView } from "@/features/results/types";

import { csvLine, type CsvValue } from "./csv";
import { LEADS_NOTE, PRIVACY_NOTE, SEGMENT_TAG, stampLabel, versionTag, verdictTag } from "./stamp";
import type { ExportDeckData } from "./types";
import { buildXlsx, type XlsxCell, type XlsxSheet, type XlsxValue } from "./xlsx";

const bold = (v: string): XlsxCell => ({ v, bold: true });
const pctCell = (v: number | null): XlsxValue => (v === null ? null : { v, percent: true });
const num = (v: number | null | undefined): number | null => (v === null || v === undefined ? null : v);

export const VERSION_HEADER = [
  "Deck",
  "Version",
  "What it says",
  "Swipers",
  "Said yes",
  "Joined waitlist",
  "Join rate",
  "Chance best",
  "Feed swipers",
  "Feed joined",
  "Link swipers",
  "Link joined",
  "Target users swipers",
  "Target users joined",
  "Tag",
];

export const SEGMENT_HEADER = ["Deck", "Split", "Group", "Swipers", "Said yes", "Joined waitlist", "Join rate", "Tag"];

export function versionRows(decks: readonly ExportDeckData[]): XlsxValue[][] {
  const rows: XlsxValue[][] = [];
  for (const { payload: p } of decks) {
    const sourceCards = new Map(p.whoSwiped.source.cards.map((c) => [c.key, c]));
    for (const r of p.leaderboard.everyone) {
      const target = p.leaderboard.target.find((t) => t.key === r.key);
      const sc = sourceCards.get(r.key);
      rows.push([
        p.deck.label,
        r.label,
        r.valueText,
        num(r.swipers),
        num(r.saidYes),
        num(r.joined),
        pctCell(r.claimRate),
        pctCell(r.chanceBest),
        num(sc?.feed?.swipers),
        num(sc?.feed?.joined),
        num(sc?.link?.swipers),
        num(sc?.link?.joined),
        target && !target.suppressed ? num(target.swipers) : null,
        target && !target.suppressed ? num(target.joined) : null,
        versionTag(p, r.key),
      ]);
    }
    const t = p.totals;
    rows.push([
      bold(p.deck.label),
      bold("Total"),
      "",
      t.swipers,
      t.saidYes,
      t.joined,
      pctCell(t.swipers === 0 ? 0 : t.joined / t.swipers),
      null,
      t.feed,
      null,
      t.link,
      null,
      null,
      null,
      verdictTag(p),
    ]);
  }
  return rows;
}

function segmentBlock(deck: string, split: string, view: SegmentView): XlsxValue[][] {
  const rows: XlsxValue[][] = view.rows.map((r) => [deck, split, r.label, r.swipers, r.saidYes, r.joined, pctCell(r.joinRate), SEGMENT_TAG]);
  if (view.other) {
    const o = view.other;
    rows.push([deck, split, LIMITS.otherLabel, o.swipers, o.saidYes, o.joined, pctCell(o.swipers ? o.joined / o.swipers : 0), SEGMENT_TAG]);
  } else if (view.groupCount > view.rows.length) {
    // Smaller than 10 together: the group exists but its numbers stay hidden.
    rows.push([deck, split, `${LIMITS.otherLabel} (under ${LIMITS.groupMinSize} swipers, hidden)`, null, null, null, null, SEGMENT_TAG]);
  }
  return rows;
}

export function segmentRows(decks: readonly ExportDeckData[]): XlsxValue[][] {
  const rows: XlsxValue[][] = [];
  for (const { payload: p } of decks) {
    const label = p.deck.label;
    const w = p.whoSwiped;
    rows.push(...segmentBlock(label, "State", w.location));
    rows.push(...segmentBlock(label, "Source", w.source));
    rows.push(...segmentBlock(label, "Interest (one person can follow several)", w.interests));
    const t = w.target;
    if (t.enough && t.target && t.everyone) {
      for (const r of [t.target, t.everyone]) {
        rows.push([label, "Target user", r.label, r.swipers, r.saidYes, r.joined, pctCell(r.joinRate), SEGMENT_TAG]);
      }
    }
  }
  return rows;
}

function heading(title: string, input: { productName: string; now: Date; scopeText: string; decks?: readonly ExportDeckData[] }): XlsxValue[][] {
  return [
    [bold(title)],
    [`${input.productName}: ${input.scopeText}`],
    [`Numbers as of ${stampLabel(input.now)}`],
    [LEADS_NOTE],
    [PRIVACY_NOTE],
    [],
  ];
}

export interface SummaryContext {
  productName: string;
  scopeText: string;
  decks: readonly ExportDeckData[];
  now: Date;
}

export function summarySheets(ctx: SummaryContext): XlsxSheet[] {
  const head = (t: string) => heading(t, ctx);
  return [
    {
      name: "Versions",
      rows: [...head("Summary table: versions"), VERSION_HEADER.map(bold), ...versionRows(ctx.decks)],
      widths: [20, 16, 40, 10, 10, 15, 10, 12, 13, 12, 13, 12, 20, 19, 26],
    },
    {
      name: "Segments",
      rows: [...head("Summary table: who swiped (leads, not results)"), SEGMENT_HEADER.map(bold), ...segmentRows(ctx.decks)],
      widths: [20, 36, 30, 10, 10, 15, 10, 8],
    },
  ];
}

export function summaryXlsx(ctx: SummaryContext): Buffer {
  return buildXlsx(summarySheets(ctx), { title: `PitchSwipe summary: ${ctx.productName}`, created: ctx.now });
}

function csvValue(v: XlsxValue): CsvValue {
  if (v === null) return "";
  if (typeof v === "object") {
    if (v.v === null) return "";
    if (v.percent && typeof v.v === "number") return `${Math.round(v.v * 1000) / 10}%`;
    return v.v;
  }
  return v;
}

/** Same content as the workbook: the two tables one after the other, each under its own header, with a blank line between. */
export function summaryCsv(ctx: SummaryContext): string {
  const lines: string[] = [];
  for (const sheet of summarySheets(ctx)) {
    for (const row of sheet.rows) lines.push(csvLine(row.map(csvValue)));
    lines.push("");
  }
  lines.pop();
  return lines.join("\r\n") + "\r\n";
}
