/**
 * Turning an uploaded list into contacts that are safe to dial.
 *
 * Every rejection is reported with its row number rather than dropped, because
 * the person uploading a list of 400 leads needs to know which eleven did not
 * make it and why. Silently ingesting 389 of 400 is the kind of thing nobody
 * notices until a client asks why their leads were never called.
 */
import { normaliseIndianNumber } from "../../../telephony/outbound";

export interface ParsedContact {
  name?: string;
  phone: string;
}

export interface RejectedRow {
  /** 1-based, counting the header, so it matches what the spreadsheet shows. */
  row: number;
  value: string;
  reason: string;
}

export interface ParseResult {
  contacts: ParsedContact[];
  rejected: RejectedRow[];
  /** Numbers that appeared more than once; only the first is kept. */
  duplicates: number;
}

/**
 * A minimal RFC 4180 field splitter — quoted fields, doubled quotes inside
 * them, commas within quotes.
 *
 * Deliberately not a dependency: the input is a two-column contact list, and
 * the failure mode of a hand-rolled parser here is a rejected row with a clear
 * reason, not corruption.
 */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(field);
      field = "";
    } else field += c;
  }
  out.push(field);
  return out.map((f) => f.trim());
}

/** Indian mobile numbers are ten digits starting 6–9. Landlines cannot receive this campaign. */
function isDialableIndianMobile(e164: string): boolean {
  return /^\+91[6-9]\d{9}$/.test(e164);
}

const HEADER_ALIASES: Record<string, "name" | "phone"> = {
  name: "name",
  "full name": "name",
  "contact name": "name",
  lead: "name",
  phone: "phone",
  mobile: "phone",
  number: "phone",
  "phone number": "phone",
  "mobile number": "phone",
  contact: "phone",
};

/**
 * Parses a CSV of contacts.
 *
 * `suppressed` is the do-not-call list. TRAI runs a national DND registry and
 * an enterprise is expected to scrub against it; this project has no access to
 * that registry, so the interface takes the list rather than pretending to
 * consult one. Numbers on it are reported as suppressed, not as errors — the
 * uploader has done nothing wrong.
 */
export function parseContactCsv(csv: string, suppressed: Set<string> = new Set()): ParseResult {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { contacts: [], rejected: [], duplicates: 0 };

  const first = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const mapped = first.map((h) => HEADER_ALIASES[h]);
  const hasHeader = mapped.some(Boolean);

  // Without a header, assume the widest common shape: name then phone, or a
  // single column of numbers.
  let nameIdx = hasHeader ? mapped.indexOf("name") : first.length > 1 ? 0 : -1;
  let phoneIdx = hasHeader ? mapped.indexOf("phone") : first.length > 1 ? 1 : 0;

  // A header row that names only one of the two columns still tells us which.
  if (hasHeader && phoneIdx === -1) phoneIdx = nameIdx === 0 ? 1 : 0;
  if (nameIdx === phoneIdx) nameIdx = -1;

  const contacts: ParsedContact[] = [];
  const rejected: RejectedRow[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  for (let i = hasHeader ? 1 : 0; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const raw = (cells[phoneIdx] ?? "").trim();
    const row = i + 1;

    if (!raw) {
      rejected.push({ row, value: lines[i].slice(0, 40), reason: "No phone number in this row" });
      continue;
    }

    const phone = normaliseIndianNumber(raw);
    if (!isDialableIndianMobile(phone)) {
      // Distinguish "you typed your own number wrong" from "this is a foreign
      // number". Only an explicit non-91 country code in the original input
      // means the latter; a bare 12345 is a domestic typo, and telling someone
      // their typo is an unsupported country is a confusing thing to read.
      const foreign = /^\+(?!91)/.test(raw.replace(/[^\d+]/g, ""));
      rejected.push({
        row,
        value: raw,
        reason: foreign
          ? "Only Indian mobile numbers are supported by this campaign"
          : "Not a valid Indian mobile number (needs 10 digits starting 6–9)",
      });
      continue;
    }
    if (suppressed.has(phone)) {
      rejected.push({ row, value: raw, reason: "On the do-not-call list" });
      continue;
    }
    if (seen.has(phone)) {
      duplicates++;
      continue;
    }

    seen.add(phone);
    const name = nameIdx >= 0 ? (cells[nameIdx] ?? "").trim() : "";
    contacts.push({ phone, ...(name ? { name } : {}) });
  }

  return { contacts, rejected, duplicates };
}
