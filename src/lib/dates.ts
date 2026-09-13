// src/lib/dates.ts
// Pure date helpers. Dates are handled as "YYYY-MM-DD" strings and parsed by
// parts, never through `new Date("YYYY-MM-DD")`, which parses as UTC midnight
// and shifts to the previous day (and month) in negative-offset time zones.

export type DateParts = { y: number; m: number; d: number };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const PRESENT = "Present";

/** Accepts "YYYY-MM-DD", "YYYY-MM", or an ISO timestamp (first 10 chars used). */
export function parseDateParts(s: string | null | undefined): DateParts | null {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(s.trim());
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = m[3] ? Number(m[3]) : 1;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return { y, m: mo, d };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO timestamp or date string -> "YYYY-MM-DD" for <input type="date">, "" if absent/unparseable. */
export function toDateInputValue(s: string | null | undefined): string {
    const p = parseDateParts(s);
    return p ? `${p.y}-${pad(p.m)}-${pad(p.d)}` : "";
}

/** "2020-05-01" -> "May 2020". "Present" passes through. Unparseable -> "". */
export function formatMonthYear(s: string | null | undefined): string {
    if (!s) return "";
    if (s.trim().toLowerCase() === PRESENT.toLowerCase()) return PRESENT;
    const p = parseDateParts(s);
    return p ? `${MONTHS[p.m - 1]} ${p.y}` : "";
}

/**
 * "Sep 2016 – May 2020", "Jan 2022 – Present", or just "Sep 2020" when there
 * is no end date. Returns "" when there is no start date either.
 */
export function formatDateRange(start: string | null | undefined, end: string | null | undefined): string {
    const a = formatMonthYear(start);
    const b = formatMonthYear(end);
    if (a && b) return `${a} – ${b}`;
    return a || b;
}

/** "YYYY-MM-DD" -> Date at UTC midnight (for Firestore Timestamp.fromDate), or null. */
export function toUtcDate(s: string | null | undefined): Date | null {
    const p = parseDateParts(s);
    return p ? new Date(Date.UTC(p.y, p.m - 1, p.d)) : null;
}
