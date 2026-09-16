// src/proxy.ts (Next 16's name for middleware). Runs before every /dashboard and /api request:
//   - a per-IP burst limit (in memory, per instance) that stops floods before they reach a route
//     handler or a page render; the durable per-user limits live in lib/security/rate-limit.ts;
//   - the sign-in redirect for /dashboard when there is no session.
// NextAuth's `auth()` wrapper decodes the session cookie and hands it over as `req.auth`.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { memoryHit } from "@/lib/security/memory-limit";
import { clientIp } from "@/lib/security/request";

const MINUTE = 60_000;

/** Requests per IP per minute. Polls run every 5 s (12/min); page views and actions are bursty but small. */
const IP_LIMITS = {
    /** NextAuth callbacks / sign-in. */
    auth: { limit: 60, windowMs: MINUTE },
    /** Everything else under /api (AI routes, polls). */
    api: { limit: 120, windowMs: MINUTE },
    /** Dashboard renders + server actions (both POST and GET on /dashboard). */
    dashboard: { limit: 240, windowMs: MINUTE },
};

export const proxy = auth(req => {
    const { pathname } = req.nextUrl;
    const ip = clientIp(req);

    if (pathname.startsWith("/api/")) {
        const policy = pathname.startsWith("/api/auth/") ? IP_LIMITS.auth : IP_LIMITS.api;
        const hit = memoryHit(`ip:${pathname.startsWith("/api/auth/") ? "auth" : "api"}:${ip}`, policy.limit, policy.windowMs);
        if (!hit.ok) {
            const seconds = Math.max(1, Math.ceil(hit.retryAfterMs / 1000));
            return NextResponse.json(
                { ok: false, error: `Too many requests. Try again in ${seconds} s.`, retryAfter: seconds, rateLimited: true },
                { status: 429, headers: { "Retry-After": String(seconds) } },
            );
        }
        return NextResponse.next();
    }

    if (pathname.startsWith("/dashboard")) {
        const hit = memoryHit(`ip:dashboard:${ip}`, IP_LIMITS.dashboard.limit, IP_LIMITS.dashboard.windowMs);
        if (!hit.ok) {
            const seconds = Math.max(1, Math.ceil(hit.retryAfterMs / 1000));
            return new NextResponse("Too many requests. Please slow down.", { status: 429, headers: { "Retry-After": String(seconds), "Content-Type": "text/plain" } });
        }
        if (!req.auth?.user?.id) {
            const login = req.nextUrl.clone();
            login.pathname = "/login";
            login.search = "";
            return NextResponse.redirect(login);
        }
    }
    return NextResponse.next();
});

export const config = {
    // Everything signed-in (pages + server actions posted to them) and every route handler.
    matcher: ["/dashboard/:path*", "/api/:path*"],
}
