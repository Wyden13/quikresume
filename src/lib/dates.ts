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

/**
 * ISO timestamp or date string -> the editor's month value "YYYY-MM-01", "" if absent/unparseable.
 * Dates are month precision: a stored day (older data) is dropped and written back as 01 on the next save.
 */
export function toDateInputValue(s: string | null | undefined): string {
    const p = parseDateParts(s);
    return p ? `${p.y}-${pad(p.m)}-01` : "";
}

/** "YYYY-MM-01" from a year and month (1-12). */
export function monthValue(y: number, m: number): string {
    return `${y}-${pad(m)}-01`;
}

/** Comparable month index (y*12 + m-1), or null. "Present" and junk give null. */
export function monthKey(s: string | null | undefined): number | null {
    const p = parseDateParts(s);
    return p ? p.y * 12 + (p.m - 1) : null;
}

export function currentMonthKey(now: Date = new Date()): number {
    return now.getFullYear() * 12 + now.getMonth();
}

/** A free-text certification year ("2025") -> 2025, or null when it is not a plain 4-digit year. */
export function parseYear(s: string | null | undefined): number | null {
    const m = /^\s*(\d{4})\s*$/.exec(s ?? "");
    return m ? Number(m[1]) : null;
}

export const MONTH_NAMES = MONTHS;

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
