/**
 * Minimal valid PDF 1.4 writer: A4 pages, Helvetica / Helvetica-Bold, headings, wrapped text,
 * simple tables, a page footer. Hand-built objects with a real xref table. No dependency.
 */

export interface PdfColumn {
  header: string;
  /** Relative width (any positive number; columns share the page width in proportion). */
  weight: number;
  align?: "left" | "right";
}

export type PdfBlock =
  | { type: "title"; text: string }
  | { type: "heading"; text: string }
  | { type: "text"; text: string; bold?: boolean; muted?: boolean; size?: number }
  | { type: "table"; columns: PdfColumn[]; rows: string[][]; boldLastRow?: boolean }
  /** `lead` insights are counted: at most `maxLeadsPerPage` per page. */
  | { type: "insight"; title: string; body: string; footnote?: string; lead?: boolean }
  | { type: "spacer"; height?: number }
  | { type: "pagebreak" };

export interface PdfDocument {
  title: string;
  /** Printed at the left of every page footer, e.g. "Numbers as of 15 Nov 2026, 18:20". */
  footer: string;
  created: Date;
  blocks: PdfBlock[];
  maxLeadsPerPage?: number;
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = PAGE_H - 56;

/** Helvetica advance widths (1/1000 em) for ASCII 32 to 126. */
const HELV = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278,
  278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722,
  667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556,
  556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const REPLACEMENTS: Record<string, string> = {
  "→": "->",
  "←": "<-",
  "–": "-",
  "—": "-",
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "…": "...",
  "₹": "Rs ",
  "•": "-",
};

/** Text the PDF can show with its built-in font: ASCII plus Latin-1; anything else becomes "?". */
export function pdfSafe(text: string): string {
  let out = "";
  for (const ch of text.normalize("NFC")) {
    const code = ch.codePointAt(0) ?? 63;
    if (REPLACEMENTS[ch]) out += REPLACEMENTS[ch];
    else if (code === 9 || code === 10 || code === 13) out += " ";
    else if (code >= 32 && code <= 126) out += ch;
    else if (code >= 160 && code <= 255) out += ch;
    else out += "?";
  }
  return out;
}

export function textWidth(text: string, size: number, bold = false): number {
  let w = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    w += code >= 32 && code <= 126 ? HELV[code - 32] : 556;
  }
  return (w / 1000) * size * (bold ? 1.06 : 1);
}

function wrap(text: string, maxWidth: number, size: number, bold = false): string[] {
  const lines: string[] = [];
  for (const para of pdfSafe(text).split(/ {2,}\n|\n/)) {
    let line = "";
    for (const word of para.split(" ").filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && textWidth(next, size, bold) > maxWidth) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

function fit(text: string, maxWidth: number, size: number, bold = false): string {
  const safe = pdfSafe(text);
  if (textWidth(safe, size, bold) <= maxWidth) return safe;
  let s = safe;
  while (s.length > 1 && textWidth(`${s}...`, size, bold) > maxWidth) s = s.slice(0, -1);
  return `${s.trimEnd()}...`;
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

function pdfDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

interface PageState {
  ops: string[];
  leads: number;
}

export function buildPdf(doc: PdfDocument): Buffer {
  const maxLeads = doc.maxLeadsPerPage ?? 2;
  const pages: PageState[] = [];
  let page!: PageState;
  let y = MARGIN;
  const newPage = () => {
    page = { ops: [], leads: 0 };
    pages.push(page);
    y = MARGIN;
  };
  newPage();
  const ensure = (h: number) => {
    if (y + h > BOTTOM) newPage();
  };
  const text = (s: string, x: number, baseline: number, size: number, bold = false, gray = 0) => {
    page.ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${gray} g ${x.toFixed(2)} ${(PAGE_H - baseline).toFixed(2)} Td (${esc(s)}) Tj ET`);
  };
  const rule = (yy: number, gray = 0.85) => {
    page.ops.push(`${gray} G 0.5 w ${MARGIN} ${(PAGE_H - yy).toFixed(2)} m ${(PAGE_W - MARGIN).toFixed(2)} ${(PAGE_H - yy).toFixed(2)} l S`);
  };
  const paragraph = (s: string, size: number, bold: boolean, gray: number, indent = 0) => {
    const lh = size * 1.35;
    for (const line of wrap(s, CONTENT_W - indent, size, bold)) {
      ensure(lh);
      text(line, MARGIN + indent, y + size, size, bold, gray);
      y += lh;
    }
  };

  for (const block of doc.blocks) {
    switch (block.type) {
      case "title":
        ensure(40);
        paragraph(block.text, 22, true, 0);
        y += 4;
        break;
      case "heading":
        ensure(50);
        y += 10;
        paragraph(block.text, 13, true, 0);
        rule(y + 1);
        y += 8;
        break;
      case "text":
        paragraph(block.text, block.size ?? 10, block.bold ?? false, block.muted ? 0.4 : 0);
        y += 3;
        break;
      case "spacer":
        y += block.height ?? 8;
        break;
      case "pagebreak":
        newPage();
        break;
      case "insight": {
        const body = wrap(block.body, CONTENT_W - 20, 9.5);
        const foot = block.footnote ? wrap(block.footnote, CONTENT_W - 20, 8.5) : [];
        const h = 12 + 14 + body.length * 12.5 + foot.length * 11.5 + 10;
        if (block.lead && page.leads >= maxLeads) newPage();
        ensure(h);
        if (block.lead) page.leads += 1;
        page.ops.push(`0.96 g ${MARGIN} ${(PAGE_H - y - h + 6).toFixed(2)} ${CONTENT_W} ${(h - 6).toFixed(2)} re f`);
        let yy = y + 8;
        text(fit(block.title, CONTENT_W - 20, 10.5, true), MARGIN + 10, yy + 10.5, 10.5, true);
        yy += 15;
        for (const l of body) {
          text(l, MARGIN + 10, yy + 9.5, 9.5);
          yy += 12.5;
        }
        for (const l of foot) {
          text(l, MARGIN + 10, yy + 8.5, 8.5, false, 0.4);
          yy += 11.5;
        }
        y += h + 2;
        break;
      }
      case "table": {
        const total = block.columns.reduce((n, c) => n + c.weight, 0);
        const widths = block.columns.map((c) => (c.weight / total) * CONTENT_W);
        const size = 8.5;
        const rowH = 16;
        const drawRow = (cells: string[], bold: boolean, shade: boolean) => {
          ensure(rowH);
          if (shade) page.ops.push(`0.95 g ${MARGIN} ${(PAGE_H - y - rowH + 4).toFixed(2)} ${CONTENT_W} ${rowH} re f`);
          let x = MARGIN;
          block.columns.forEach((col, i) => {
            const cell = fit(cells[i] ?? "", widths[i] - 8, size, bold);
            const w = textWidth(cell, size, bold);
            const cx = col.align === "right" ? x + widths[i] - 4 - w : x + 4;
            text(cell, cx, y + 8.5, size, bold);
            x += widths[i];
          });
          y += rowH;
        };
        drawRow(block.columns.map((c) => c.header), true, true);
        block.rows.forEach((row, i) => {
          // A table that runs onto a new page repeats its header.
          if (y + rowH > BOTTOM) {
            newPage();
            drawRow(block.columns.map((c) => c.header), true, true);
          }
          drawRow(row, !!block.boldLastRow && i === block.rows.length - 1, false);
        });
        rule(y + 2, 0.9);
        y += 8;
        break;
      }
    }
  }

  // Footers (need the page count).
  pages.forEach((p, i) => {
    page = p;
    rule(PAGE_H - 40, 0.85);
    text(fit(doc.footer, CONTENT_W - 80, 8), MARGIN, PAGE_H - 28, 8, false, 0.4);
    const label = `Page ${i + 1} of ${pages.length}`;
    text(label, PAGE_W - MARGIN - textWidth(label, 8), PAGE_H - 28, 8, false, 0.4);
  });

  // Objects: 1 catalog, 2 pages, 3 F1, 4 F2, 5 info, then (page, content) pairs.
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  const kids = pages.map((_, i) => `${6 + i * 2} 0 R`).join(" ");
  objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  objects[5] = `<< /Title (${esc(pdfSafe(doc.title))}) /Producer (PitchSwipe) /CreationDate (${pdfDate(doc.created)}) >>`;
  const streams: Buffer[] = [];
  pages.forEach((p, i) => {
    const pageNo = 6 + i * 2;
    const data = Buffer.from(p.ops.join("\n"), "latin1");
    objects[pageNo] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageNo + 1} 0 R >>`;
    objects[pageNo + 1] = "";
    streams[pageNo + 1] = data;
  });

  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1")];
  const offsets: number[] = [];
  let pos = parts[0].length;
  for (let n = 1; n < objects.length; n++) {
    offsets[n] = pos;
    const stream = streams[n];
    const chunk = stream
      ? Buffer.concat([Buffer.from(`${n} 0 obj\n<< /Length ${stream.length} >>\nstream\n`, "latin1"), stream, Buffer.from("\nendstream\nendobj\n", "latin1")])
      : Buffer.from(`${n} 0 obj\n${objects[n]}\nendobj\n`, "latin1");
    parts.push(chunk);
    pos += chunk.length;
  }
  const count = objects.length;
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let n = 1; n < count; n++) xref += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${count} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
  parts.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(parts);
}
