"use server"

import { revalidatePath } from "next/cache"
import type { AwardItem } from "@/types/db";
import { currentUid, requireUid } from "@/lib/db/session";
import { LIMITS } from "@/lib/validation/limits";
import {
    tagFieldsOf, deleteUserDoc, formBool, formStr, formStrOrNull, isoOf, readCol, strOf, strOrNull, toTimestamp, updateUserDoc,
} from "@/lib/db/user-collection";

const COL = "awards";

export async function getAwards(): Promise<AwardItem[]> {
    const uid = await currentUid();
    if (!uid) return [];

    return readCol(uid, COL, { field: "createdAt", dir: "desc" }, (id, d) => ({
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
    const uid = await requireUid();

    const patch: Record<string, unknown> = {};
    if (formData.has("title")) patch.title = formStr(formData, "title");
    if (formData.has("issuer")) patch.issuer = formStrOrNull(formData, "issuer");
    if (formData.has("date")) patch.date = toTimestamp(formStr(formData, "date", 32));
    if (formData.has("description")) patch.description = formStrOrNull(formData, "description", LIMITS.long);
    if (formData.has("isSelected")) patch.isSelected = formBool(formData, "isSelected");

    if (Object.keys(patch).length > 0) await updateUserDoc(uid, COL, awardId, patch);
    revalidatePath("/dashboard")
}

export async function deleteAward(awardId: string) {
    const uid = await requireUid();
    await deleteUserDoc(uid, COL, awardId);
    revalidatePath("/dashboard")
}
