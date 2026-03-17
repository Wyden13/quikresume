"use server"

import { auth } from "@/auth"
import { db } from "@/lib/firestore"
import { SkillCategory } from "@/types/schema"
import {revalidatePath} from "next/cache";

export async function getSkills() {
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
            ...data,
            updatedAt: data.updatedAt?.toDate().toISOString() || null,
            createdAt: data.createdAt?.toDate().toISOString() || null,
        };
    }) as SkillCategory[];
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
