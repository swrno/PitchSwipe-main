/** Turns the founder's choices into files, and several files into one zip. Pure. */
import { reportPdf } from "./report";
import { stampLabel, stampSlug, LEADS_NOTE, PRIVACY_NOTE } from "./stamp";
import { summaryCsv, summaryXlsx } from "./summary";
import { swipesCsv, waitlistCsv } from "./swipes";
import { EXPORT_FILE_LABELS, EXPORT_FILES, type ExportFile, type ExportInput, type ExportOutputFile } from "./types";
import { buildZip } from "./zip";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "product";
}

/** Files for the chosen kinds, in a fixed order. The summary table gives an .xlsx and a .csv. */
export function buildExportFiles(input: ExportInput): ExportOutputFile[] {
  const { now, decks } = input;
  const scopeText = input.scope === "product" ? `whole product, ${decks.length} test${decks.length === 1 ? "" : "s"}` : `this test: ${decks[0]?.payload.deck.label ?? ""}`;
  const base = `pitchswipe-${slug(input.productName)}-${input.scope === "product" ? "all-decks" : slug(decks[0]?.payload.deck.label ?? "deck")}`;
  const stamp = stampSlug(now);
  const ctx = { productName: input.productName, scopeText, decks, now };
  const chosen = new Set<ExportFile>(input.files);
  const out: ExportOutputFile[] = [];

  for (const kind of EXPORT_FILES) {
    if (!chosen.has(kind)) continue;
    if (kind === "report") {
      out.push({ name: `${base}-report-${stamp}.pdf`, contentType: "application/pdf", data: reportPdf(ctx) });
    } else if (kind === "summary") {
      if (input.summaryFormat !== "csv") out.push({ name: `${base}-summary-${stamp}.xlsx`, contentType: XLSX_TYPE, data: summaryXlsx(ctx) });
      if (input.summaryFormat !== "xlsx") out.push({ name: `${base}-summary-${stamp}.csv`, contentType: "text/csv; charset=utf-8", data: Buffer.from(summaryCsv(ctx), "utf8") });
    } else if (kind === "swipes") {
      out.push({ name: `${base}-every-swipe-${stamp}.csv`, contentType: "text/csv; charset=utf-8", data: Buffer.from(swipesCsv(decks, now), "utf8") });
    } else {
      out.push({ name: `${base}-waitlist-${stamp}.csv`, contentType: "text/csv; charset=utf-8", data: Buffer.from(waitlistCsv(decks, now), "utf8") });
    }
  }
  return out;
}

export function readmeText(input: ExportInput, files: readonly ExportOutputFile[]): string {
  return [
    "PitchSwipe results export",
    `${input.productName}, ${input.scope === "product" ? "whole product" : "this test"}`,
    `Numbers as of ${stampLabel(input.now)}`,
    "",
    "Files:",
    ...files.map((f) => `- ${f.name}`),
    "",
    LEADS_NOTE,
    PRIVACY_NOTE,
    "",
    `Selected: ${input.files.map((f) => EXPORT_FILE_LABELS[f]).join(", ")}`,
    "",
  ].join("\r\n");
}

export interface ExportBundle {
  name: string;
  contentType: string;
  data: Buffer;
  /** Files inside (one entry when the download is a single file). */
  files: string[];
}

/** One output file is returned as is; several (or `forceZip`) become one .zip. */
export function bundleExport(input: ExportInput, options: { forceZip?: boolean } = {}): ExportBundle {
  const files = buildExportFiles(input);
  if (files.length === 0) throw new Error("No files selected");
  if (files.length === 1 && !options.forceZip) {
    const f = files[0];
    return { name: f.name, contentType: f.contentType, data: f.data, files: [f.name] };
  }
  const first = files[0].name.replace(/-(report|summary|every-swipe|waitlist)-.*$/, "");
  const zipName = `${first}-${stampSlug(input.now)}.zip`;
  const entries = [...files.map((f) => ({ name: f.name, data: f.data })), { name: "README.txt", data: Buffer.from(readmeText(input, files), "utf8") }];
  return { name: zipName, contentType: "application/zip", data: buildZip(entries, input.now), files: files.map((f) => f.name) };
}
