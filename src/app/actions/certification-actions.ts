"use server"

import { auth } from "@/auth"
import { db } from "@/lib/firestore"
import { revalidatePath } from "next/cache"
import { Timestamp } from "firebase-admin/firestore";
import type { CertificationItem } from "@/types/db";


interface UpdateCertificationData {
    name?: string;
    issuer?: string | null;
    year?: string;
    isSelected?: boolean;
    updatedAt: Timestamp;
}

// --- READ ---
export async function getCertifications(): Promise<CertificationItem[]> {
    const session = await auth()
    if (!session?.user?.id) return []

    const snapshot = await db
        .collection("users")
        .doc(session.user.id)
        .collection("certifications")
        .orderBy("createdAt", "desc")
        .get()

    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name ?? "",
            issuer: data.issuer ?? null,
            year: data.year ?? "",
            isSelected: Boolean(data.isSelected),
            createdAt: data.createdAt?.toDate().toISOString() ?? null,
            updatedAt: data.updatedAt?.toDate().toISOString() ?? null,
        };
    });
}

// --- UPDATE (partial) ---
export async function updateCertification(certificationId: string, formData: FormData) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const updateData: UpdateCertificationData = { updatedAt: Timestamp.now() }

    if (formData.has("name")) updateData.name = formData.get("name") as string;
    if (formData.has("issuer")) updateData.issuer = (formData.get("issuer") as string) || null;
    if (formData.has("year")) updateData.year = formData.get("year") as string;
    if (formData.has("isSelected")) {
        updateData.isSelected = formData.get("isSelected") === "on" || formData.get("isSelected") === "true";
    }

    if (Object.keys(updateData).length > 1) {
        await db
            .collection("users")
            .doc(session.user.id)
            .collection("certifications")
            .doc(certificationId)
            .update({ ...updateData })
    }

    revalidatePath("/dashboard")
}

// --- DELETE ---
export async function deleteCertification(certificationId: string) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    await db
        .collection("users")
        .doc(session.user.id)
        .collection("certifications")
        .doc(certificationId)
        .delete()

    revalidatePath("/dashboard")
}
