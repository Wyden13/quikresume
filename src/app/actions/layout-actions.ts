"use server"

import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { readMeta, replaceMeta } from "@/lib/db/meta"
import { normalizeLayout } from "@/lib/layout/presets"
import type { ResumeLayout } from "@/lib/layout/types"

/** The working layout (section order, item order, spacing), normalised. */
export async function getLayout(): Promise<ResumeLayout> {
    const session = await auth()
    if (!session?.user?.id) return normalizeLayout(null)
    return normalizeLayout(await readMeta(session.user.id, "layout"))
}

/** Replaces the working layout. Used by the Library (drag to reorder saves instantly). */
export async function updateLayout(layout: ResumeLayout): Promise<void> {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")
    await replaceMeta(session.user.id, "layout", { ...normalizeLayout(layout) })
    revalidatePath("/dashboard")
}
