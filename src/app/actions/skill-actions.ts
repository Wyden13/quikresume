"use server"

import { auth } from "@/auth"
import { db } from "@/lib/firestore"
import { SkillCategory } from "@/types/schema"

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
