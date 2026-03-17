"use server"

import { auth } from "@/auth"
import { db } from "@/lib/firestore"
import { revalidatePath } from "next/cache"
import { Timestamp } from "firebase-admin/firestore";

// --- TYPE DEFINITION ---
// This completely removes the ESLint 'any' error and gives WebStorm perfect autocomplete
export interface ExperienceItem {
    id: string;
    position: string;
    company: string;
    isActive: boolean;
    isSelected: boolean;
    startDate: string;
    endDate: string | null;
    description: string[];
    createdAt: string;
    updatedAt?: string | null;
}

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

// --- 0. READ ---
export async function getExperiences() {
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
            ...data,
            startDate: data.startDate?.toDate().toISOString(),
            endDate: data.endDate?.toDate().toISOString() || null,
            createdAt: data.createdAt?.toDate().toISOString(),
            updatedAt: data.updatedAt?.toDate().toISOString() || null,
        };
    }) as ExperienceItem[]; // We will refine the type in the next step or keep as any for now to avoid conflicts
}

// --- 1. CREATE ---
export async function createExperience(formData: FormData){
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const startStr = formData.get("startStr") as string
    const endStr = formData.get("endStr") as string
    const position = formData.get("position") as string;
    const company = formData.get("company") as string;

    if (!position || !company || !startStr) {
        throw new Error("Missing required fields: Position, Company, and Start Date are mandatory.");
    }

    const data = {
        position: position,
        company: company,
        startDate: Timestamp.fromDate(new Date(startStr)),
        endDate: endStr ? Timestamp.fromDate(new Date(endStr)) : null,
        description: (formData.get("description") as string || "").split("\n").filter(line => line.trim() !== ""),
        isActive: formData.get("isActive") === "on",
        isSelected: false,
        createdAt: Timestamp.now(),
    }

    await db
        .collection("users")
        .doc(session.user.id)
        .collection("experience")
        .add(data)

    revalidatePath("/test")
    revalidatePath("/work-test")
    revalidatePath("/dashboard")
}

// --- 2. UPDATE (Handles partial updates flawlessly) ---
export async function updateExperience(experienceId: string, formData: FormData) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    // We start with only the updatedAt timestamp
    const updateData: UpdateExperienceData = {
        updatedAt: Timestamp.now(),
    }

    // Only add text fields if they are explicitly passed in the formData
    if (formData.has("position")) {
        updateData.position = formData.get("position") as string;
    }
    if (formData.has("company")) {
        updateData.company = formData.get("company") as string;
    }

    // Only add description if passed
    if (formData.has("description")) {
        const desc = formData.get("description") as string;
        updateData.description = desc.split("\n").filter(line => line.trim() !== "");
    }

    // Only update dates if passed
    if (formData.has("startStr")) {
        const startStr = formData.get("startStr") as string;
        if (startStr) updateData.startDate = Timestamp.fromDate(new Date(startStr));
    }

    if (formData.has("endStr")) {
        const endStr = formData.get("endStr") as string;
        updateData.endDate = endStr ? Timestamp.fromDate(new Date(endStr)) : null;
    }

    // Only update toggles if explicitly sent
    // Note: If you send 'true' or 'false' as strings from a custom switch component, this handles it.
    if (formData.has("isActive")) {
        updateData.isActive = formData.get("isActive") === "on" || formData.get("isActive") === "true";
    }
    if (formData.has("isSelected")) {
        updateData.isSelected = formData.get("isSelected") === "on" || formData.get("isSelected") === "true";
    }

    // Execute the update only if there's data to change (prevent empty updates)
    if (Object.keys(updateData).length > 1) {
        await db
            .collection("users")
            .doc(session.user.id)
            .collection("experience")
            .doc(experienceId)
            .update({...updateData}) // Spread operator ensures Firestore accepts the clean object
    }

    revalidatePath("/test")
    revalidatePath("/work-test")
    revalidatePath("/dashboard")
}

// --- 3. DELETE ---
export async function deleteExperience(experienceId: string) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    await db
        .collection("users")
        .doc(session.user.id)
        .collection("experience")
        .doc(experienceId)
        .delete()

    revalidatePath("/test")
    revalidatePath("/work-test")
    revalidatePath("/dashboard")
}