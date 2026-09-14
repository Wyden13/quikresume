"use server"

import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { Timestamp } from "firebase-admin/firestore";
import { readMeta, writeMeta } from "@/lib/db/meta";
import type { CharacterizationStatus } from "@/lib/about/types";

export interface CharacterizationSummary {
    status: CharacterizationStatus | null;
    /** Hash of the answers the current brief was written from (reviews compare against it). */
    briefHash: string | null;
}

/** Light read for the dashboard: first-run redirect, nudge banner, outdated-review checks. */
export async function getCharacterizationSummary(): Promise<CharacterizationSummary | null> {
    const session = await auth()
    if (!session?.user?.id) return null
    const d = await readMeta(session.user.id, "characterization");
    const status = d.status === "draft" || d.status === "skipped" || d.status === "complete" ? d.status : null;
    return { status, briefHash: typeof d.briefHash === "string" ? d.briefHash : null };
}

/**
 * The first-run redirect happens once: opening the questionnaire marks it seen (as skipped while nothing is
 * saved), so the sidebar's Library link doesn't bounce back here. The nudge banner keeps reminding.
 */
export async function markCharacterizationSeen(): Promise<void> {
    const session = await auth()
    if (!session?.user?.id) return
    const d = await readMeta(session.user.id, "characterization");
    if (d.status) return;
    await writeMeta(session.user.id, "characterization", { status: "skipped", skippedAt: Timestamp.now() });
}

/** "Skip for now": stops the first-run redirect. A completed questionnaire is never downgraded. */
export async function skipCharacterization(): Promise<void> {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")
    const d = await readMeta(session.user.id, "characterization");
    if (d.status === "complete" || d.status === "draft") return;
    await writeMeta(session.user.id, "characterization", { status: "skipped", skippedAt: Timestamp.now() });
    revalidatePath("/dashboard")
}
