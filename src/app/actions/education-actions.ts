"use server"

import { auth } from "@/auth"
import { db } from "@/lib/firestore"
import { revalidatePath } from "next/cache"
import { Timestamp } from "firebase-admin/firestore";
import { toUtcDate } from "@/lib/dates";
import type { EducationItem } from "@/types/db";


interface UpdateEducationData {
    schoolName?: string;
    locationCity?: string | null;
    locationProvince?: string | null;
    locationCountry?: string | null;
    programName?: string;
    minorName?: string | null;
    doubleMajor?: string | null;
    gpa?: string | null;
    details?: string | null;
    startDate?: Timestamp;
    endDate?: Timestamp | null;
    isActive?: boolean;
    isSelected?: boolean;
    updatedAt: Timestamp;
}

const toTimestamp = (s: string | null) => {
    const d = toUtcDate(s);
    return d ? Timestamp.fromDate(d) : null;
};

// --- READ ---
export async function getEducations(): Promise<EducationItem[]> {
    const session = await auth()
    if (!session?.user?.id) return []

    const snapshot = await db
        .collection("users")
        .doc(session.user.id)
        .collection("education")
        .orderBy("startDate", "desc")
        .get()

    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            schoolName: data.schoolName ?? "",
            locationCity: data.locationCity ?? null,
            locationProvince: data.locationProvince ?? null,
            locationCountry: data.locationCountry ?? null,
            programName: data.programName ?? "",
            minorName: data.minorName ?? null,
            doubleMajor: data.doubleMajor ?? null,
            gpa: data.gpa ?? null,
            details: data.details ?? null,
            startDate: data.startDate?.toDate().toISOString() ?? null,
            endDate: data.endDate?.toDate().toISOString() ?? null,
            isActive: Boolean(data.isActive),
            isSelected: Boolean(data.isSelected),
            createdAt: data.createdAt?.toDate().toISOString() ?? null,
            updatedAt: data.updatedAt?.toDate().toISOString() ?? null,
        };
    });
}

// --- UPDATE (partial: only fields present in the FormData are written) ---
export async function updateEducation(educationId: string, formData: FormData) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const updateData: UpdateEducationData = { updatedAt: Timestamp.now() }

    if (formData.has("schoolName")) updateData.schoolName = formData.get("schoolName") as string;
    if (formData.has("programName")) updateData.programName = formData.get("programName") as string;

    // Optional strings: empty -> null to keep the documents clean
    if (formData.has("locationCity")) updateData.locationCity = (formData.get("locationCity") as string) || null;
    if (formData.has("locationProvince")) updateData.locationProvince = (formData.get("locationProvince") as string) || null;
    if (formData.has("locationCountry")) updateData.locationCountry = (formData.get("locationCountry") as string) || null;
    if (formData.has("minorName")) updateData.minorName = (formData.get("minorName") as string) || null;
    if (formData.has("doubleMajor")) updateData.doubleMajor = (formData.get("doubleMajor") as string) || null;
    if (formData.has("gpa")) updateData.gpa = (formData.get("gpa") as string) || null;
    if (formData.has("details")) updateData.details = (formData.get("details") as string) || null;

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
            .collection("education")
            .doc(educationId)
            .update({ ...updateData })
    }

    revalidatePath("/dashboard")
}

// --- DELETE ---
export async function deleteEducation(educationId: string) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    await db
        .collection("users")
        .doc(session.user.id)
        .collection("education")
        .doc(educationId)
        .delete()

    revalidatePath("/dashboard")
}
