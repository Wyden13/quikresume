// src/lib/import/dates.ts
// Normalises the free-form dates a resume parser returns ("2021", "Jan 2021",
// "03/2021", "2021-03", "Spring 2020", "Present") into the editor's
// "YYYY-MM-DD" | "Present" | "" convention. Pure; parses by parts (see
// src/lib/dates.ts for why).

import { parseDateParts, PRESENT, toDateInputValue } from "@/lib/dates";

const MONTHS: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
    jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
    oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const SEASONS: Record<string, number> = { spring: 3, summer: 6, fall: 9, autumn: 9, winter: 12 };

const PRESENT_RE = /^(present|current|currently|now|ongoing|to\s*date|till\s*date|today)$/i;

const ymd = (y: number, m: number, d = 1) => {
    if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return "";
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

export function normalizeImportedDate(raw: unknown): string {
    if (raw == null) return "";
    const t = String(raw).trim().replace(/\.$/, "");
    if (!t) return "";
    if (PRESENT_RE.test(t)) return PRESENT;

    let m: RegExpExecArray | null;
    if ((m = /^(\d{4})$/.exec(t))) return ymd(Number(m[1]), 1);
    if (/^\d{4}-\d{2}(-\d{2})?/.test(t)) {
        const p = parseDateParts(t);
        return p ? toDateInputValue(t) : "";
    }
    if ((m = /^(\d{4})[/.](\d{1,2})$/.exec(t))) return ymd(Number(m[1]), Number(m[2]));
    if ((m = /^(\d{1,2})[/.-](\d{4})$/.exec(t))) return ymd(Number(m[2]), Number(m[1]));
    if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t))) return ymd(Number(m[3]), Number(m[1]), Number(m[2]));
    if ((m = /^([A-Za-z]{3,9})\.?,?\s+(\d{4})$/.exec(t))) {
        const mo = MONTHS[m[1].toLowerCase()] ?? SEASONS[m[1].toLowerCase()];
        if (mo) return ymd(Number(m[2]), mo);
    }
    if ((m = /^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(t))) {
        const mo = MONTHS[m[1].toLowerCase()];
        if (mo) return ymd(Number(m[3]), mo, Number(m[2]));
    }
    if ((m = /^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/.exec(t))) {
        const mo = MONTHS[m[2].toLowerCase()];
        if (mo) return ymd(Number(m[3]), mo, Number(m[1]));
    }
    // Last resort: any 4-digit year, with a month name if one is present.
    if ((m = /\b((?:19|20)\d{2})\b/.exec(t))) {
        const word = /([A-Za-z]{3,9})/.exec(t)?.[1]?.toLowerCase();
        const mo = (word && (MONTHS[word] ?? SEASONS[word])) || 1;
        return ymd(Number(m[1]), mo);
    }
    return "";
}

/**
 * "Jan 2020 – Present" -> ["Jan 2020", "Present"]; null when the string does
 * not look like a range. Used when the model stuffs a range into startDate.
 */
export function splitDateRange(raw: unknown): [string, string] | null {
    if (typeof raw !== "string") return null;
    const parts = raw.split(/\s*(?:[-–—]|\bto\b|\buntil\b)\s*/i).map(p => p.trim()).filter(Boolean);
    return parts.length === 2 ? [parts[0], parts[1]] : null;
}

/** Normalises a start/end pair, splitting a range out of startDate if needed. */
export function normalizeDateRange(start: unknown, end: unknown): { startDate: string; endDate: string } {
    let s = normalizeImportedDate(start);
    let e = normalizeImportedDate(end);
    if (!e && typeof start === "string") {
        const range = splitDateRange(start);
        if (range) {
            s = normalizeImportedDate(range[0]);
            e = normalizeImportedDate(range[1]);
        }
    }
    if (s === PRESENT) s = "";
    return { startDate: s, endDate: e };
}

/** Certifications store a bare year string. */
export function normalizeYear(raw: unknown): string {
    if (raw == null) return "";
    const m = /\b((?:19|20)\d{2})\b/.exec(String(raw));
    return m ? m[1] : "";
}
