"use server"

import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import type { LanguageItem } from "@/types/db";
import {
    deleteUserDoc, formBool, formStrOrNull, isoOf, readCol, strOf, strOrNull, updateUserDoc,
} from "@/lib/db/user-collection";

const COL = "languages";

export async function getLanguages(): Promise<LanguageItem[]> {
    const session = await auth()
    if (!session?.user?.id) return []

    return readCol(session.user.id, COL, { field: "createdAt", dir: "desc" }, (id, d) => ({
        id,
        language: strOf(d.language),
        proficiency: strOrNull(d.proficiency),
        isSelected: Boolean(d.isSelected),
        createdAt: isoOf(d.createdAt),
        updatedAt: isoOf(d.updatedAt),
    }));
}

// Partial update: only fields present in the FormData are written.
export async function updateLanguage(languageId: string, formData: FormData) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const patch: Record<string, unknown> = {};
    if (formData.has("language")) patch.language = formData.get("language") as string;
    if (formData.has("proficiency")) patch.proficiency = formStrOrNull(formData, "proficiency");
    if (formData.has("isSelected")) patch.isSelected = formBool(formData, "isSelected");

    if (Object.keys(patch).length > 0) await updateUserDoc(session.user.id, COL, languageId, patch);
    revalidatePath("/dashboard")
}

export async function deleteLanguage(languageId: string) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    await deleteUserDoc(session.user.id, COL, languageId);
    revalidatePath("/dashboard")
}
