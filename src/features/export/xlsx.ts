/**
 * Minimal valid XLSX writer: a zip of hand-built OOXML parts (workbook, sheets, styles,
 * core properties). Strings are inline (no shared string table). No dependency.
 */
import { buildZip } from "./zip";

export interface XlsxCell {
  v: string | number | null;
  bold?: boolean;
  /** Value is a fraction 0 to 1 shown as a percentage. */
  percent?: boolean;
}
export type XlsxValue = string | number | null | XlsxCell;

export interface XlsxSheet {
  name: string;
  rows: XlsxValue[][];
  /** Column widths in characters. */
  widths?: number[];
}

export interface XlsxMeta {
  title?: string;
  created?: Date;
}

export function xmlEscape(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function columnName(index: number): string {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    name = String.fromCharCode(65 + r) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

/** Excel sheet names: 1 to 31 characters, none of []:*?/\ and unique. */
export function sheetName(raw: string, used: Set<string>): string {
  const base = (raw.replace(/[[\]:*?/\\]/g, " ").trim() || "Sheet").slice(0, 31);
  let name = base;
  for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base.slice(0, 31 - String(i).length - 1)} ${i}`;
  used.add(name.toLowerCase());
  return name;
}

function cellXml(ref: string, value: XlsxValue): string {
  const cell: XlsxCell = value !== null && typeof value === "object" ? value : { v: value };
  const style = cell.percent ? 2 : cell.bold ? 1 : 0;
  const s = style ? ` s="${style}"` : "";
  if (cell.v === null || cell.v === "") return style ? `<c r="${ref}"${s}/>` : "";
  if (typeof cell.v === "number") return Number.isFinite(cell.v) ? `<c r="${ref}"${s}><v>${cell.v}</v></c>` : "";
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cell.v)}</t></is></c>`;
}

function sheetXml(sheet: XlsxSheet): string {
  const cols = sheet.widths?.length
    ? `<cols>${sheet.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`
    : "";
  const rows = sheet.rows
    .map((row, r) => {
      const cells = row.map((v, c) => cellXml(`${columnName(c)}${r + 1}`, v)).join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${rows}</sheetData></worksheet>`
  );
}

const STYLES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="3">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `<xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

export function buildXlsx(sheets: readonly XlsxSheet[], meta: XlsxMeta = {}): Buffer {
  if (sheets.length === 0) throw new Error("A workbook needs at least one sheet");
  const created = meta.created ?? new Date();
  const used = new Set<string>();
  const names = sheets.map((s) => sheetName(s.name, used));
  const ns = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`;

  const parts: { name: string; data: Uint8Array }[] = [];
  const add = (name: string, text: string) => parts.push({ name, data: Buffer.from(text, "utf8") });

  add(
    "[Content_Types].xml",
    `${xml}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      sheets
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join("") +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
      `</Types>`,
  );
  add(
    "_rels/.rels",
    `${xml}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="${ns}/officeDocument" Target="xl/workbook.xml"/>` +
      `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
      `</Relationships>`,
  );
  add(
    "docProps/core.xml",
    `${xml}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
      `<dc:title>${xmlEscape(meta.title ?? "PitchSwipe export")}</dc:title><dc:creator>PitchSwipe</dc:creator>` +
      `<dcterms:created xsi:type="dcterms:W3CDTF">${created.toISOString().replace(/\.\d+Z$/, "Z")}</dcterms:created></cp:coreProperties>`,
  );
  add(
    "xl/workbook.xml",
    `${xml}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${ns}"><sheets>` +
      names.map((n, i) => `<sheet name="${xmlEscape(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
      `</sheets></workbook>`,
  );
  add(
    "xl/_rels/workbook.xml.rels",
    `${xml}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${ns}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
      `<Relationship Id="rId${sheets.length + 1}" Type="${ns}/styles" Target="styles.xml"/></Relationships>`,
  );
  add("xl/styles.xml", STYLES);
  sheets.forEach((s, i) => add(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)));
  return buildZip(parts, created);
}
