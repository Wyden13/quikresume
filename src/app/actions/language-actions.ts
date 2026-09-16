"use server"

import { revalidatePath } from "next/cache"
import type { LanguageItem } from "@/types/db";
import { currentUid, requireUid } from "@/lib/db/session";
import { LIMITS } from "@/lib/validation/limits";
import {
    tagFieldsOf, deleteUserDoc, formBool, formStr, formStrOrNull, isoOf, readCol, strOf, strOrNull, updateUserDoc,
} from "@/lib/db/user-collection";

const COL = "languages";

export async function getLanguages(): Promise<LanguageItem[]> {
    const uid = await currentUid();
    if (!uid) return [];

    return readCol(uid, COL, { field: "createdAt", dir: "desc" }, (id, d) => ({
        id,
        language: strOf(d.language),
        proficiency: strOrNull(d.proficiency),
        isSelected: Boolean(d.isSelected),
        ...tagFieldsOf(d),
        createdAt: isoOf(d.createdAt),
        updatedAt: isoOf(d.updatedAt),
    }));
}

// Partial update: only fields present in the FormData are written.
export async function updateLanguage(languageId: string, formData: FormData) {
    const uid = await requireUid();

    const patch: Record<string, unknown> = {};
    if (formData.has("language")) patch.language = formStr(formData, "language");
    if (formData.has("proficiency")) patch.proficiency = formStrOrNull(formData, "proficiency", LIMITS.field);
    if (formData.has("isSelected")) patch.isSelected = formBool(formData, "isSelected");

    if (Object.keys(patch).length > 0) await updateUserDoc(uid, COL, languageId, patch);
    revalidatePath("/dashboard")
}

export async function deleteLanguage(languageId: string) {
    const uid = await requireUid();
    await deleteUserDoc(uid, COL, languageId);
    revalidatePath("/dashboard")
}
