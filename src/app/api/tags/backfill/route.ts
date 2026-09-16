// src/app/api/tags/backfill/route.ts
// POST { force?: boolean } -> re-extracts tags for every stale persisted item
// (or every item with `force`) and writes them. Used by the Insights view for
// libraries that predate smart tags or whose save-time tagging failed.
//
// Guarded (lib/security/guard.ts): same-origin, session, per-user rate limit, daily AI budget.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "@/lib/firestore";
import { GlmError, glmErrorStatus } from "@/lib/glm/client";
import { extractTags, TagError } from "@/lib/tags/extract";
import { mergeTagAliases, readTagAliases } from "@/lib/db/meta";
import { allInputs, contentHashOf, PROFILE_ID, profileHashOf, staleInputs, tagContext } from "@/lib/tags/content";
import { SECTION_COLLECTION } from "@/lib/sections";
import { loadResumeData } from "@/lib/db/load-resume";
import { RESUME_LIST_KEYS } from "@/types/schema";
import { guardApi } from "@/lib/security/guard";
import { RATE } from "@/lib/security/rate-limit";
import { withAiUser } from "@/lib/security/ai-budget";
import { readJsonBody } from "@/lib/security/request";

export const runtime = "nodejs";
export const maxDuration = 120;

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
    const g = await guardApi(req, RATE.tagsBackfill, { ai: true, feature: "Skill analysis", what: "full re-analyses" });
    if (!g.ok) return g.response;
    const uid = g.uid;

    const parsed = await readJsonBody<{ force?: unknown }>(req, 64 * 1024);
    if (!parsed.ok) return parsed.response;
    const force = parsed.body.force === true;

    return withAiUser(uid, "tags-backfill", async () => {
        const data = await loadResumeData(uid, g.session.user?.name);
        const inputs = force ? allInputs(data) : staleInputs(data);
        if (inputs.length === 0) return NextResponse.json({ ok: true, tagged: 0, skipped: 0 });

        try {
            const result = await extractTags(inputs, await readTagAliases(uid), { budgetMs: 100_000, context: tagContext(data) });
            const now = Timestamp.now();
            const userRef = db.collection("users").doc(uid);
            // update(), not set(merge): an item deleted while the model ran must not be recreated as a tags-only doc.
            const writes: Promise<unknown>[] = [];
            if (result.tagsById[PROFILE_ID]) {
                const h = profileHashOf(data.personalInfo);
                writes.push(userRef.update({ profileTags: result.tagsById[PROFILE_ID], profileContentHash: h, profileTagsHash: h, profileTaggedAt: now }));
            }
            for (const key of RESUME_LIST_KEYS) {
                for (const item of data[key]) {
                    const tags = result.tagsById[item.id];
                    if (!tags) continue;
                    const h = contentHashOf(key, item);
                    writes.push(userRef.collection(SECTION_COLLECTION[key]).doc(item.id).update({ tags, contentHash: h, tagsHash: h, taggedAt: now, updatedAt: now }));
                }
            }
            const failed = (await Promise.allSettled(writes)).filter(r => r.status === "rejected" && (r.reason as { code?: number })?.code !== 5);
            if (failed.length > 0) console.error("[tags/backfill] some writes failed:", (failed[0] as PromiseRejectedResult).reason);
            await mergeTagAliases(uid, result.aliases);
            revalidatePath("/dashboard");
            return NextResponse.json({ ok: true, tagged: Object.keys(result.tagsById).length, skipped: result.skipped.length });
        } catch (err) {
            console.error("[tags/backfill]", err);
            if (err instanceof GlmError) return fail(glmErrorStatus(err), err.message);
            return fail(502, err instanceof TagError ? err.message : "Skill analysis failed. Please try again.");
        }
    });
}
