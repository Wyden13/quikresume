"use server"

import { revalidatePath } from "next/cache"
import type { SkillCategoryItem } from "@/types/db";
import { currentUid, requireUid } from "@/lib/db/session";
import { LIMITS } from "@/lib/validation/limits";
import { deleteUserDoc, formBool, formStr, formStrArray, isoOf, readCol, strArray, strOf, tagFieldsOf, updateUserDoc } from "@/lib/db/user-collection";

const COL = "skills";

export async function getSkills(): Promise<SkillCategoryItem[]> {
    const uid = await currentUid();
    if (!uid) return [];

    // No orderBy (it would drop documents missing the field): oldest first, so the
    // manual baseline stays stable until the user drags the section.
    const rows = await readCol(uid, COL, null, (id, d) => ({
        id,
        category: strOf(d.category),
        items: strOf(d.items),
        hidden: strArray(d.hidden),
        isSelected: Boolean(d.isSelected),
        ...tagFieldsOf(d),
        updatedAt: isoOf(d.updatedAt),
        createdAt: isoOf(d.createdAt),
    }));
    return rows.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
}

export async function deleteSkill(skillId: string) {
    const uid = await requireUid();
    await deleteUserDoc(uid, COL, skillId);
    revalidatePath("/dashboard")
}

// --- UPDATE (partial: only fields present in the FormData are written) ---
export async function updateSkill(skillId: string, formData: FormData) {
    const uid = await requireUid();

    const patch: Record<string, unknown> = {};
    if (formData.has("category")) patch.category = formStr(formData, "category") || "General";
    if (formData.has("items")) patch.items = formStr(formData, "items", LIMITS.long);
    if (formData.has("isSelected")) patch.isSelected = formBool(formData, "isSelected");
    if (formData.has("hidden")) patch.hidden = formStrArray(formData, "hidden");

    if (Object.keys(patch).length > 0) await updateUserDoc(uid, COL, skillId, patch);
    revalidatePath("/dashboard")
}
