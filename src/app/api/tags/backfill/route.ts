// src/app/api/tags/backfill/route.ts
// POST { force?: boolean } -> re-extracts tags for every stale persisted item
// (or every item with `force`) and writes them. Used by the Insights view for
// libraries that predate smart tags or whose save-time tagging failed.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";
import { auth } from "@/auth";
import { db } from "@/lib/firestore";
import { isGlmConfigured } from "@/lib/glm/client";
import { extractTags, TagError } from "@/lib/tags/extract";
import { mergeTagAliases, readTagAliases } from "@/lib/db/meta";
import { allInputs, contentHashOf, PROFILE_ID, profileHashOf, staleInputs, tagContext } from "@/lib/tags/content";
import { SECTION_COLLECTION } from "@/lib/sections";
import { loadResumeData } from "@/lib/db/load-resume";
import { RESUME_LIST_KEYS } from "@/types/schema";

export const runtime = "nodejs";
export const maxDuration = 120;

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return fail(401, "You need to be signed in.");
    if (!isGlmConfigured()) return fail(500, "Skill analysis is not configured on this server (GLM_API_KEY missing).");
    const uid = session.user.id;

    let force = false;
    try {
        const body = await req.json();
        force = Boolean(body?.force);
    } catch { /* empty body is fine */ }

    const data = await loadResumeData(uid, session.user.name);
    const inputs = force ? allInputs(data) : staleInputs(data);
    if (inputs.length === 0) return NextResponse.json({ ok: true, tagged: 0, skipped: 0 });

    try {
        const result = await extractTags(inputs, await readTagAliases(uid), { budgetMs: 100_000, context: tagContext(data) });
        const now = Timestamp.now();
        const userRef = db.collection("users").doc(uid);
        let batch = db.batch();
        let n = 0;
        const flush = async () => { await batch.commit(); batch = db.batch(); n = 0; };

        if (result.tagsById[PROFILE_ID]) {
            const h = profileHashOf(data.personalInfo);
            batch.set(userRef, { profileTags: result.tagsById[PROFILE_ID], profileContentHash: h, profileTagsHash: h, profileTaggedAt: now }, { merge: true });
            n++;
        }
        for (const key of RESUME_LIST_KEYS) {
            for (const item of data[key]) {
                const tags = result.tagsById[item.id];
                if (!tags) continue;
                const h = contentHashOf(key, item);
                batch.set(userRef.collection(SECTION_COLLECTION[key]).doc(item.id), { tags, contentHash: h, tagsHash: h, taggedAt: now, updatedAt: now }, { merge: true });
                if (++n >= 450) await flush();
            }
        }
        if (n > 0) await flush();
        await mergeTagAliases(uid, result.aliases);
        revalidatePath("/dashboard");
        return NextResponse.json({ ok: true, tagged: Object.keys(result.tagsById).length, skipped: result.skipped.length });
    } catch (err) {
        console.error("[tags/backfill]", err);
        return fail(502, err instanceof TagError ? err.message : "Skill analysis failed. Please try again.");
    }
}
