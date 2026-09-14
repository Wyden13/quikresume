// src/lib/db/characterization.ts
// Server-only access to users/{uid}/meta/characterization ("About you").

import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { readMeta, replaceMeta } from "@/lib/db/meta";
import { stripUndefined } from "@/lib/db/jobs";
import { readCharacterization, type CandidatePromptContext, type Characterization } from "@/lib/about/types";

const DOC = "characterization";

export async function readCharacterizationDoc(uid: string): Promise<Characterization> {
    return readCharacterization(await readMeta(uid, DOC));
}

/** The brief + facts for prompts, or null while there is no brief yet. Never throws: prompts work without it. */
export async function readCandidateContext(uid: string): Promise<CandidatePromptContext | null> {
    try {
        const c = await readCharacterizationDoc(uid);
        if (!c.brief || !c.briefHash || !c.facts) return null;
        return { brief: c.brief, briefHash: c.briefHash, facts: c.facts };
    } catch (err) {
        console.error("[characterization] read failed:", err);
        return null;
    }
}

/** Replaces the whole document (arrays and nested answers are rewritten, not merged). */
export async function saveCharacterizationDoc(uid: string, doc: Characterization, extra: Record<string, unknown> = {}): Promise<void> {
    await replaceMeta(uid, DOC, stripUndefined({
        ...doc,
        briefAt: doc.briefAt ? Timestamp.fromDate(new Date(doc.briefAt)) : null,
        ...extra,
    }) as Record<string, unknown>);
}
