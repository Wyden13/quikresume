"use server"

import { auth } from "@/auth"
import { db } from "@/lib/firestore"
import { revalidatePath } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";
import type { SkillCategoryItem } from "@/types/db";


export async function getSkills(): Promise<SkillCategoryItem[]> {
    const session = await auth()
    if (!session?.user?.id) return []

    const snapshot = await db
        .collection("users")
        .doc(session.user.id)
        .collection("skills")
        .get()

    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            category: data.category ?? "",
            items: data.items ?? "",
            isSelected: Boolean(data.isSelected),
            updatedAt: data.updatedAt?.toDate().toISOString() ?? null,
            createdAt: data.createdAt?.toDate().toISOString() ?? null,
        };
    });
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

export async function updateSkill(skillId: string, formData: FormData) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const isSelected = formData.get("isSelected") === "true"

    await db
        .collection("users")
        .doc(session.user.id)
        .collection("skills")
        .doc(skillId)
        .update({
            isSelected,
            updatedAt: Timestamp.now()
        })

    revalidatePath("/dashboard")
}
