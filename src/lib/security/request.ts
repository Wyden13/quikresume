// src/lib/security/request.ts
// Request-level checks shared by the route handlers and the proxy: same-origin enforcement for
// cookie-authenticated POSTs (CSRF), the caller's IP, and bounded JSON body reading.

import { NextResponse } from "next/server";

/** Largest JSON body a route accepts (the Job Match routes carry a whole library). */
export const MAX_JSON_BYTES = 2 * 1024 * 1024;

/**
 * True when the request was made by this site. Browsers send `Sec-Fetch-Site` on every request and
 * `Origin` on cross-origin ones (and on all POSTs); either mismatch means a cross-site form or fetch
 * is trying to spend this user's session. Requests without either header (curl, old clients) pass:
 * they carry no ambient cookie a third party could exploit.
 */
export function isSameOrigin(req: Request): boolean {
    const site = req.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") return false;
    const origin = req.headers.get("origin");
    if (!origin || origin === "null") return !origin;
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (!host) return false;
    try {
        return new URL(origin).host.toLowerCase() === host.split(",")[0].trim().toLowerCase();
    } catch {
        return false;
    }
}

/** Best-effort client address behind the platform's proxy. */
export function clientIp(req: Request): string {
    const fwd = req.headers.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0].trim();
    return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export type BodyResult<T> = { ok: true; body: T } | { ok: false; response: NextResponse };

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

/** Reads a JSON body without letting a client stream an unbounded payload into memory. */
export async function readJsonBody<T = Record<string, unknown>>(req: Request, maxBytes = MAX_JSON_BYTES): Promise<BodyResult<T>> {
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > maxBytes) return { ok: false, response: fail(413, "That request is too large.") };
    let text: string;
    try {
        text = await req.text();
    } catch {
        return { ok: false, response: fail(400, "Could not read the request body.") };
    }
    if (text.length > maxBytes) return { ok: false, response: fail(413, "That request is too large.") };
    if (text.trim() === "") return { ok: true, body: {} as T };
    try {
        const parsed = JSON.parse(text) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, response: fail(400, "Expected a JSON object.") };
        return { ok: true, body: parsed as T };
    } catch {
        return { ok: false, response: fail(400, "Expected a JSON body.") };
    }
}
