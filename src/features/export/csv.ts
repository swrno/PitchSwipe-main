/** Dependency-free CSV writer. RFC 4180 quoting, CRLF rows, spreadsheet-formula guard. */

export type CsvValue = string | number | boolean | null | undefined;

/** Cells starting with = + - @ (or tab/CR) get a leading quote so a spreadsheet never runs them as formulas. */
export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  const text = String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function csvLine(values: readonly CsvValue[]): string {
  return values.map(csvCell).join(",");
}

/** Rows to CSV text, ending with CRLF. */
export function toCsv(rows: readonly (readonly CsvValue[])[]): string {
  return rows.map(csvLine).join("\r\n") + "\r\n";
}

/** Minimal RFC 4180 parser, used by tests to read the output back. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
