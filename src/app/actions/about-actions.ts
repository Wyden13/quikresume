"use server"

import { revalidatePath } from "next/cache"
import { Timestamp } from "firebase-admin/firestore";
import { currentUid, requireUid } from "@/lib/db/session";
import { readMeta, writeMeta } from "@/lib/db/meta";
import type { CharacterizationStatus } from "@/lib/about/types";

export interface CharacterizationSummary {
    status: CharacterizationStatus | null;
    /** Hash of the answers the current brief was written from (reviews compare against it). */
    briefHash: string | null;
}

/** Light read for the dashboard: first-run redirect, nudge banner, outdated-review checks. */
export async function getCharacterizationSummary(): Promise<CharacterizationSummary | null> {
    const uid = await currentUid();
    if (!uid) return null
    const d = await readMeta(uid, "characterization");
    const status = d.status === "draft" || d.status === "skipped" || d.status === "complete" ? d.status : null;
    return { status, briefHash: typeof d.briefHash === "string" ? d.briefHash : null };
}

/**
 * The first-run redirect happens once: opening the questionnaire marks it seen (as skipped while nothing is
 * saved), so the sidebar's Library link doesn't bounce back here. The nudge banner keeps reminding.
 */
export async function markCharacterizationSeen(): Promise<void> {
    const uid = await currentUid();
    if (!uid) return
    const d = await readMeta(uid, "characterization");
    if (d.status) return;
    await writeMeta(uid, "characterization", { status: "skipped", skippedAt: Timestamp.now() });
}

/** "Skip for now": stops the first-run redirect. A completed questionnaire is never downgraded. */
export async function skipCharacterization(): Promise<void> {
    const uid = await requireUid();
    const d = await readMeta(uid, "characterization");
    if (d.status === "complete" || d.status === "draft") return;
    await writeMeta(uid, "characterization", { status: "skipped", skippedAt: Timestamp.now() });
    revalidatePath("/dashboard")
}
