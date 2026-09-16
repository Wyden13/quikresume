// src/app/api/tags/analyze/route.ts
// POST { items: TagInput[], context?: string } -> { ok, tagsById, skipped }. Tags unsaved draft
// items (or an uploaded resume) without persisting anything but new aliases.
// A Route Handler so the GLM call can run under its own maxDuration.
//
// Guarded (lib/security/guard.ts): same-origin, session, per-user rate limit, daily AI budget.

import { NextResponse } from "next/server";
import { extractTags, TagError } from "@/lib/tags/extract";
import { mergeTagAliases, readTagAliases } from "@/lib/db/meta";
import type { TagInput } from "@/lib/tags/content";
import { RESUME_LIST_KEYS } from "@/types/schema";
import { guardApi } from "@/lib/security/guard";
import { RATE } from "@/lib/security/rate-limit";
import { withAiUser } from "@/lib/security/ai-budget";
import { readJsonBody } from "@/lib/security/request";
import { sanitizeForPrompt } from "@/lib/security/prompt";
import { isDocId } from "@/lib/validation/limits";
import { GlmError, glmErrorStatus } from "@/lib/glm/client";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_ITEMS = 200;
const MAX_TEXT = 4000;
const SECTIONS = new Set<string>([...RESUME_LIST_KEYS, "profile"]);

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
    const g = await guardApi(req, RATE.tagsAnalyze, { ai: true, feature: "Skill analysis", what: "skill analyses" });
    if (!g.ok) return g.response;

    const parsed = await readJsonBody<{ items?: unknown; context?: unknown }>(req);
    if (!parsed.ok) return parsed.response;
    const body = parsed.body;
    if (!Array.isArray(body.items)) return fail(400, "Expected an `items` array.");
    if (body.items.length > MAX_ITEMS) return fail(413, `At most ${MAX_ITEMS} items can be analysed at once.`);

    const items: TagInput[] = [];
    for (const raw of body.items) {
        if (!raw || typeof raw !== "object") continue;
        const o = raw as Record<string, unknown>;
        if (typeof o.text !== "string" || typeof o.section !== "string" || !SECTIONS.has(o.section)) continue;
        // Draft items carry temp ids (tmp-<uuid>) or document ids; "profile" is the headline + summary.
        if (!(isDocId(o.id) || o.id === "profile")) continue;
        const text = sanitizeForPrompt(o.text, MAX_TEXT);
        if (text === "") continue;
        items.push({ id: o.id, section: o.section as TagInput["section"], text });
    }
    if (items.length === 0) return NextResponse.json({ ok: true, tagsById: {}, skipped: [] });

    return withAiUser(g.uid, "tags", async () => {
        try {
            const uid = g.uid;
            const context = typeof body.context === "string" ? sanitizeForPrompt(body.context, 1500) : "";
            const result = await extractTags(items, await readTagAliases(uid), { budgetMs: 100_000, context });
            await mergeTagAliases(uid, result.aliases);
            return NextResponse.json({ ok: true, tagsById: result.tagsById, skipped: result.skipped });
        } catch (err) {
            console.error("[tags/analyze]", err);
            if (err instanceof GlmError) return fail(glmErrorStatus(err), err.message);
            return fail(502, err instanceof TagError ? err.message : "Skill analysis failed. Please try again.");
        }
    });
}
