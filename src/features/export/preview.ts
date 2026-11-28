/**
 * Small previews of each export file for the Download results dialog. Pure.
 * Built from the same rows the real files use, so the preview cannot drift from the download.
 * Privacy: waitlist emails are partly hidden here; the real CSV keeps the full address.
 */
import { stampLabel } from "./stamp";
import { SWIPE_HEADER, swipeRows } from "./swipes";
import { VERSION_HEADER, versionRows } from "./summary";
import type { ExportDeckData, ExportScope } from "./types";
import type { XlsxValue } from "./xlsx";

export const PREVIEW_ROWS = 4;

export interface TablePreview {
  header: string[];
  rows: string[][];
  /** Rows in the real file (data rows, not the header). */
  total: number;
  /** Plain name of one row, for "N swipes". */
  unit: string;
}

export interface PdfPreview {
  productName: string;
  testLabel: string;
  statusLabel: string;
  headline: string;
  swipers: number;
  saidYes: number;
  saidYesPct: number;
  joined: number;
  joinedPct: number;
  /** Section names in the PDF, in order. */
  sections: string[];
  tests: number;
}

export interface ExportPreview {
  stamp: string;
  pdf: PdfPreview;
  summary: TablePreview;
  swipes: TablePreview;
  waitlist: TablePreview;
}

/** "seed…@pitchswipe.invalid": first letters of the name, then the domain. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "…";
  const name = email.slice(0, at);
  const keep = name.length <= 2 ? 1 : Math.min(4, name.length - 1);
  return `${name.slice(0, keep)}…${email.slice(at)}`;
}

function cell(v: XlsxValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if (v.v === null) return "";
    if (v.percent && typeof v.v === "number") return `${Math.round(v.v * 1000) / 10}%`;
    return String(v.v);
  }
  return String(v);
}

const SUMMARY_COLUMNS = ["Version", "Swipers", "Said yes", "Joined waitlist", "Join rate", "Chance best", "Tag"];
const SWIPE_COLUMNS = ["time_utc", "version", "answer", "comment", "state", "source"];
const WAITLIST_COLUMNS = ["email", "version", "claimed_at_utc"];

function pick<T>(header: readonly string[], row: readonly T[], wanted: readonly string[]): T[] {
  return wanted.map((w) => row[header.indexOf(w)]);
}

export function pdfSections(tests: number): string[] {
  return [
    ...(tests > 1 ? ["Tests in this report"] : []),
    "Verdict and key numbers",
    "Funnel",
    "Leaderboard",
    "Waitlist users",
    "Audience & who swiped: state, source, interests, target users, with a lead note for each",
  ];
}

export function buildExportPreview(decks: readonly ExportDeckData[], _scope: ExportScope, now: Date): ExportPreview {
  const first = decks[0].payload;
  const versions = decks.flatMap((d) => versionRows([d]).filter((_, i, all) => i < all.length - 1));
  const allSwipes = decks.flatMap((d) => swipeRows(d));
  const claims = decks.flatMap((d) =>
    [...d.claimants].sort((a, b) => b.claimedAt.getTime() - a.claimedAt.getTime()).map((c) => [maskEmail(c.email), c.cardLabel, c.claimedAt.toISOString()]),
  );
  const swipeHeader = [...SWIPE_HEADER] as string[];
  return {
    stamp: stampLabel(now),
    pdf: {
      productName: first.deck.productName,
      testLabel: first.deck.label,
      statusLabel: first.deck.statusLabel,
      headline: first.verdict.headline,
      swipers: first.totals.swipers,
      saidYes: first.totals.saidYes,
      saidYesPct: first.totals.saidYesPct,
      joined: first.totals.joined,
      joinedPct: first.totals.joinedPct,
      sections: pdfSections(decks.length),
      tests: decks.length,
    },
    summary: {
      header: SUMMARY_COLUMNS,
      rows: versions.slice(0, PREVIEW_ROWS).map((r) => pick(VERSION_HEADER, r, SUMMARY_COLUMNS).map(cell)),
      total: versions.length,
      unit: "version",
    },
    swipes: {
      header: SWIPE_COLUMNS,
      rows: allSwipes.slice(0, PREVIEW_ROWS).map((r) => pick(swipeHeader, r, SWIPE_COLUMNS).map(String)),
      total: allSwipes.length,
      unit: "swipe",
    },
    waitlist: { header: WAITLIST_COLUMNS, rows: claims.slice(0, PREVIEW_ROWS), total: claims.length, unit: "email" },
  };
}
