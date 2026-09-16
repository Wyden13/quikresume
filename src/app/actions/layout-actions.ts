"use server"

import { revalidatePath } from "next/cache"
import { currentUid, requireUid } from "@/lib/db/session"
import { readMeta, replaceMeta } from "@/lib/db/meta"
import { normalizeLayout } from "@/lib/layout/presets"
import type { ResumeLayout } from "@/lib/layout/types"

/** The working layout (section order, item order, spacing), normalised. */
export async function getLayout(): Promise<ResumeLayout> {
    const uid = await currentUid();
    if (!uid) return normalizeLayout(null)
    return normalizeLayout(await readMeta(uid, "layout"))
}

/** Replaces the working layout. Used by the Library (drag to reorder saves instantly). */
export async function updateLayout(layout: ResumeLayout): Promise<void> {
    const uid = await requireUid();
    await replaceMeta(uid, "layout", { ...normalizeLayout(layout) })
    revalidatePath("/dashboard")
}
