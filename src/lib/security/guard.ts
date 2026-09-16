// src/lib/security/guard.ts
// One entry check for every route handler: same-origin (CSRF) for state-changing methods, session,
// per-user rate limit, and, for AI routes, configuration + the daily AI budget. Returns either the
// user id or the response to send back.

import "server-only";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { isGlmConfigured } from "@/lib/glm/client";
import { isSameOrigin } from "./request";
import { rateLimit, rateLimitResponse, type RatePolicy } from "./rate-limit";
import { AiBudgetError, assertAiBudget } from "./ai-budget";

export type GuardResult =
    | { ok: true; uid: string; session: Session }
    | { ok: false; response: NextResponse };

const fail = (status: number, error: string, extra: Record<string, unknown> = {}) =>
    NextResponse.json({ ok: false, error, ...extra }, { status });

export interface GuardOptions {
    /** The route calls the model: require GLM_API_KEY and an unspent daily budget. */
    ai?: boolean;
    /** Feature name for the "not configured" message. */
    feature?: string;
    /** What the 429 message counts ("imports", "analyses"...). */
    what?: string;
}

export async function guardApi(req: Request, policy: RatePolicy, opts: GuardOptions = {}): Promise<GuardResult> {
    if (req.method !== "GET" && req.method !== "HEAD" && !isSameOrigin(req)) {
        return { ok: false, response: fail(403, "Cross-site requests are not allowed.") };
    }
    const session = await auth();
    const uid = session?.user?.id;
    if (!uid) return { ok: false, response: fail(401, "You need to be signed in.") };

    const limit = await rateLimit(policy, uid);
    if (!limit.ok) return { ok: false, response: rateLimitResponse(limit, opts.what ?? "requests") };

    if (opts.ai) {
        if (!isGlmConfigured()) {
            return { ok: false, response: fail(500, `${opts.feature ?? "This feature"} is not configured on this server (GLM_API_KEY missing).`, { disabled: true }) };
        }
        try {
            await assertAiBudget(uid);
        } catch (err) {
            if (err instanceof AiBudgetError) return { ok: false, response: fail(429, err.message, { budgetExhausted: true }) };
            throw err;
        }
    }
    return { ok: true, uid, session: session as Session };
}
