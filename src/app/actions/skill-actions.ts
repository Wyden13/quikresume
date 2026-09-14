"use server"

import { auth } from "@/auth"
import { db } from "@/lib/firestore"
import { revalidatePath } from "next/cache"
import { formBool, formStrArray, strArray, tagFieldsOf, updateUserDoc } from "@/lib/db/user-collection";
import type { SkillCategoryItem } from "@/types/db";


export async function getSkills(): Promise<SkillCategoryItem[]> {
    const session = await auth()
    if (!session?.user?.id) return []

    const snapshot = await db
        .collection("users")
        .doc(session.user.id)
        .collection("skills")
        .get()

    const rows = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            category: data.category ?? "",
            items: data.items ?? "",
            hidden: strArray(data.hidden),
            isSelected: Boolean(data.isSelected),
            ...tagFieldsOf(data),
            updatedAt: data.updatedAt?.toDate().toISOString() ?? null,
            createdAt: data.createdAt?.toDate().toISOString() ?? null,
        };
    })
    // No orderBy (it would drop documents missing the field): oldest first, so the
    // manual baseline stays stable until the user drags the section.
    return rows.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
}

export async function deleteSkill(skillId: string) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    await db
        .collection("users")
        .doc(session.user.id)
        .collection("skills")
        .doc(skillId)
        .delete()

    revalidatePath("/dashboard")
}

// --- UPDATE (partial: only fields present in the FormData are written) ---
export async function updateSkill(skillId: string, formData: FormData) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const patch: Record<string, unknown> = {};
    if (formData.has("isSelected")) patch.isSelected = formBool(formData, "isSelected");
    if (formData.has("hidden")) patch.hidden = formStrArray(formData, "hidden");

    if (Object.keys(patch).length > 0) await updateUserDoc(session.user.id, "skills", skillId, patch);
    revalidatePath("/dashboard")
}
