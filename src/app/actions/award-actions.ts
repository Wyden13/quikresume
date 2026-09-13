"use server"

import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import type { AwardItem } from "@/types/db";
import {
    tagFieldsOf, deleteUserDoc, formBool, formStrOrNull, isoOf, readCol, strOf, strOrNull, toTimestamp, updateUserDoc,
} from "@/lib/db/user-collection";

const COL = "awards";

export async function getAwards(): Promise<AwardItem[]> {
    const session = await auth()
    if (!session?.user?.id) return []

    return readCol(session.user.id, COL, { field: "createdAt", dir: "desc" }, (id, d) => ({
        id,
        title: strOf(d.title),
        issuer: strOrNull(d.issuer),
        date: isoOf(d.date),
        description: strOrNull(d.description),
        isSelected: Boolean(d.isSelected),
        ...tagFieldsOf(d),
        createdAt: isoOf(d.createdAt),
        updatedAt: isoOf(d.updatedAt),
    }));
}

// Partial update: only fields present in the FormData are written.
export async function updateAward(awardId: string, formData: FormData) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const patch: Record<string, unknown> = {};
    if (formData.has("title")) patch.title = formData.get("title") as string;
    if (formData.has("issuer")) patch.issuer = formStrOrNull(formData, "issuer");
    if (formData.has("date")) patch.date = toTimestamp(formData.get("date") as string);
    if (formData.has("description")) patch.description = formStrOrNull(formData, "description");
    if (formData.has("isSelected")) patch.isSelected = formBool(formData, "isSelected");

    if (Object.keys(patch).length > 0) await updateUserDoc(session.user.id, COL, awardId, patch);
    revalidatePath("/dashboard")
}

export async function deleteAward(awardId: string) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    await deleteUserDoc(session.user.id, COL, awardId);
    revalidatePath("/dashboard")
}
