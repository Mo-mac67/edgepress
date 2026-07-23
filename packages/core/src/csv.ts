/**
 * Minimal RFC-4180-ish CSV parsing/serialization (no dependency). Handles
 * quoted fields, escaped quotes ("") and commas/newlines inside quotes.
 */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += c;
  }
  // flush last field/row (unless the file ended exactly on a newline)
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ""));
}

/** Parse a CSV with a header row into objects keyed by header. */
export function parseCsvObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = r[i] ?? ""; });
    return obj;
  });
}

const escapeCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** Serialize rows (array of objects) to CSV using the given ordered keys. */
export function toCsv(keys: string[], rows: Record<string, unknown>[]): string {
  const header = keys.map(escapeCell).join(",");
  const body = rows.map((r) => keys.map((k) => escapeCell(r[k])).join(","));
  return [header, ...body].join("\n");
}
