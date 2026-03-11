/**
 * Robust CSV parser that handles:
 * - Quoted fields (commas inside quotes)
 * - Escaped quotes ("" → ")
 * - Windows (\r\n) and Unix (\n) line endings
 * - BOM markers
 */

export type CsvRow = Record<string, string>;

export interface CsvParseResult {
  headers: string[];
  rows: CsvRow[];
}

/**
 * Parse a CSV string into headers and typed row objects.
 * Handles quoted fields, escaped quotes, and mixed line endings.
 */
export function parseCsv(text: string): CsvParseResult {
  // Strip BOM
  const clean = text.replace(/^\uFEFF/, "").trim();
  if (!clean) return { headers: [], rows: [] };

  const lines = splitCsvLines(clean);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]).map((h) =>
    h.trim().toLowerCase().replace(/\s+/g, "_")
  );

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // skip empty lines

    const values = parseCsvLine(line);
    const row: CsvRow = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? "").trim();
    });
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Split a CSV text into logical lines, respecting quoted fields
 * that may contain newlines.
 */
function splitCsvLines(text: string): string[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i++; // skip \r\n
      lines.push(current);
      current = "";
    } else {
      current += ch;
    }
  }

  if (current) lines.push(current);
  return lines;
}

/**
 * Parse a single CSV line into an array of field values.
 * Handles quoted fields with escaped quotes ("").
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        // Escaped quote ""
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }

  fields.push(current);
  return fields;
}

/**
 * Validate that required headers exist.
 * Returns list of missing headers.
 */
export function validateHeaders(
  headers: string[],
  required: string[]
): string[] {
  return required.filter((h) => !headers.includes(h));
}

/**
 * Split an array into chunks of a given size.
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
