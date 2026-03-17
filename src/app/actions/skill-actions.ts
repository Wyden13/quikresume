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

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })) as SkillCategory[];
}
