"use server"

import { auth } from "@/auth"
import { db } from "@/lib/firestore"
import { revalidatePath } from "next/cache"
import { tagFieldsOf } from "@/lib/db/user-collection";
import { Timestamp } from "firebase-admin/firestore";
import { toUtcDate } from "@/lib/dates";
import type { ExperienceItem } from "@/types/db";


interface UpdateExperienceData {
    position?: string;
    company?: string;
    isActive?: boolean;
    isSelected?: boolean;
    startDate?: Timestamp;
    endDate?: Timestamp | null;
    description?: string[];
    updatedAt: Timestamp;
}

const toTimestamp = (s: string | null) => {
    const d = toUtcDate(s);
    return d ? Timestamp.fromDate(d) : null;
};

// --- READ ---
export async function getExperiences(): Promise<ExperienceItem[]> {
    const session = await auth()
    if (!session?.user?.id) return []

    const snapshot = await db
        .collection("users")
        .doc(session.user.id)
        .collection("experience")
        .orderBy("startDate", "desc")
        .get()

    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            position: data.position ?? "",
            company: data.company ?? "",
            isActive: Boolean(data.isActive),
            isSelected: Boolean(data.isSelected),
            ...tagFieldsOf(data),
            startDate: data.startDate?.toDate().toISOString() ?? null,
            endDate: data.endDate?.toDate().toISOString() ?? null,
            description: Array.isArray(data.description) ? data.description : [],
            createdAt: data.createdAt?.toDate().toISOString() ?? null,
            updatedAt: data.updatedAt?.toDate().toISOString() ?? null,
        };
    });
}

// --- UPDATE (partial: only fields present in the FormData are written) ---
export async function updateExperience(experienceId: string, formData: FormData) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const updateData: UpdateExperienceData = { updatedAt: Timestamp.now() }

    if (formData.has("position")) updateData.position = formData.get("position") as string;
    if (formData.has("company")) updateData.company = formData.get("company") as string;
    if (formData.has("description")) {
        updateData.description = ((formData.get("description") as string) || "")
            .split("\n").filter(line => line.trim() !== "");
    }
    if (formData.has("startDate")) {
        const ts = toTimestamp(formData.get("startDate") as string);
        if (ts) updateData.startDate = ts;
    }
    if (formData.has("endDate")) updateData.endDate = toTimestamp(formData.get("endDate") as string);
    if (formData.has("isActive")) {
        updateData.isActive = formData.get("isActive") === "on" || formData.get("isActive") === "true";
    }
    if (formData.has("isSelected")) {
        updateData.isSelected = formData.get("isSelected") === "on" || formData.get("isSelected") === "true";
    }

    if (Object.keys(updateData).length > 1) {
        await db
            .collection("users")
            .doc(session.user.id)
            .collection("experience")
            .doc(experienceId)
            .update({ ...updateData })
    }

    revalidatePath("/dashboard")
}

// --- DELETE ---
export async function deleteExperience(experienceId: string) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    await db
        .collection("users")
        .doc(session.user.id)
        .collection("experience")
        .doc(experienceId)
        .delete()

    revalidatePath("/dashboard")
}
