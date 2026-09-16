"use server"

import { db } from "@/lib/firestore"
import { revalidatePath } from "next/cache"
import { Timestamp } from "firebase-admin/firestore";
import { RESUME_LIST_KEYS, type ResumeListKey } from "@/types/schema";
import { SECTION_COLLECTION } from "@/lib/sections";
import { userCol } from "@/lib/db/user-collection";
import { requireUid } from "@/lib/db/session";

const BATCH_LIMIT = 450;

/** Library "Include all / Exclude all": sets `isSelected` on every item of one section (the working selection). */
export async function setSectionSelection(section: ResumeListKey, isSelected: boolean): Promise<{ updated: number }> {
    const uid = await requireUid();
    if (!RESUME_LIST_KEYS.includes(section)) throw new Error("Unknown section")

    const snap = await userCol(uid, SECTION_COLLECTION[section]).select("isSelected").get();
    const refs = snap.docs.filter(d => d.get("isSelected") !== Boolean(isSelected)).map(d => d.ref);
    const now = Timestamp.now();
    for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        for (const ref of refs.slice(i, i + BATCH_LIMIT)) batch.update(ref, { isSelected: Boolean(isSelected), updatedAt: now });
        await batch.commit();
    }
    revalidatePath("/dashboard")
    return { updated: refs.length };
}
