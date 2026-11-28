/**
 * Shapes for the Download results export (WP11). Everything here is plain data so the
 * file builders stay pure and testable.
 */
import type { ResultsPayload } from "@/features/results/types";

export const EXPORT_FILES = ["report", "summary", "swipes", "waitlist"] as const;
export type ExportFile = (typeof EXPORT_FILES)[number];

export const EXPORT_FILE_LABELS: Record<ExportFile, string> = {
  report: "Results report",
  summary: "Summary table",
  swipes: "Every swipe",
  waitlist: "Waitlist emails",
};

export const EXPORT_SCOPES = ["deck", "product"] as const;
export type ExportScope = (typeof EXPORT_SCOPES)[number];

/** One counted swipe. Never carries a name, email, IP or any id that points to a person. */
export interface ExportSwipe {
  at: Date;
  /** "Headline B". */
  cardLabel: string;
  answer: "yes" | "no";
  /** Typed comment, or the English text of a voice comment. */
  comment: string;
  /** Estimated state, or null when there was no estimate. */
  region: string | null;
  source: "feed" | "link";
  interests: string[];
}

/** A person who explicitly claimed the reward. The only place an email appears in an export. */
export interface ExportClaimant {
  email: string;
  cardLabel: string;
  claimedAt: Date;
}

export interface ExportDeckData {
  payload: ResultsPayload;
  swipes: ExportSwipe[];
  claimants: ExportClaimant[];
}

export interface ExportInput {
  productName: string;
  scope: ExportScope;
  decks: ExportDeckData[];
  files: ExportFile[];
  /** Summary table only: just the .xlsx or just the .csv. Both when omitted. */
  summaryFormat?: "xlsx" | "csv";
  /** The moment the numbers were taken. Stamped on every file. */
  now: Date;
  /** Founder's light-theme colours for the PDF report. Default theme when omitted. */
  theme?: import("./pdf").PdfTheme;
}

export interface ExportOutputFile {
  name: string;
  contentType: string;
  data: Buffer;
}
