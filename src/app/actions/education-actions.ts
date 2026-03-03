"use server"

import { auth } from "@/auth"
import { db } from "@/lib/firestore"
import { revalidatePath } from "next/cache"
import { Timestamp } from "firebase-admin/firestore";

// --- TYPE DEFINITION ---
// Ensures strict typing for partial updates and fixes ESLint 'any' errors
interface UpdateEducationData {
    schoolName?: string;
    locationCity?: string;
    locationProvince?: string | null;
    locationCountry?: string | null;
    programName?: string;
    minorName?: string | null;
    doubleMajor?: string | null;
    gpa?: string | null;
    startDate?: Timestamp;
    endDate?: Timestamp | null;
    isActive?: boolean;
    isSelected?: boolean;
    updatedAt: Timestamp;
}

// --- 1. CREATE ---
export async function createEducation(formData: FormData){
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const startStr = formData.get("startDate") as string
    const endStr = formData.get("endDate") as string

    const schoolName = formData.get("schoolName") as string
    const locationCity = formData.get("locationCity") as string
    const programName = formData.get("programName") as string

    if (!schoolName || !locationCity || !programName || !startStr) {
        throw new Error("Missing required fields: School, City, Program, and Start Date are mandatory.");
    }

    const data = {
        // REQUIRED
        schoolName: schoolName,
        locationCity: locationCity,
        programName: programName,
        startDate: Timestamp.fromDate(new Date(startStr)),
        // Handles "Present" if endStr is empty
        endDate: endStr ? Timestamp.fromDate(new Date(endStr)) : null,

        // OPTIONAL
        locationProvince: formData.get("locationProvince") as string || null,
        locationCountry: formData.get("locationCountry") as string || null,
        minorName: formData.get("minorName") as string || null,
        doubleMajor: formData.get("doubleMajor") as string || null,
        gpa: formData.get("gpa") as string || null,

        // Read toggle from form (defaults to false if not checked)
        isActive: formData.get("isActive") === "on",
        isSelected: false,
        createdAt: Timestamp.now(),
    }

    await db
        .collection("users")
        .doc(session.user.id)
        .collection("education")
        .add(data)

    revalidatePath("/test")
}

// --- 2. UPDATE (Handles partial updates flawlessly) ---
export async function updateEducation(educationId: string, formData: FormData) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const updateData: UpdateEducationData = {
        updatedAt: Timestamp.now(),
    }

    // Required Strings
    if (formData.has("schoolName")) updateData.schoolName = formData.get("schoolName") as string;
    if (formData.has("locationCity")) updateData.locationCity = formData.get("locationCity") as string;
    if (formData.has("programName")) updateData.programName = formData.get("programName") as string;

    // Optional Strings (convert empty strings to null to keep DB clean)
    if (formData.has("locationProvince")) updateData.locationProvince = formData.get("locationProvince") as string || null;
    if (formData.has("locationCountry")) updateData.locationCountry = formData.get("locationCountry") as string || null;
    if (formData.has("minorName")) updateData.minorName = formData.get("minorName") as string || null;
    if (formData.has("doubleMajor")) updateData.doubleMajor = formData.get("doubleMajor") as string || null;
    if (formData.has("gpa")) updateData.gpa = formData.get("gpa") as string || null;

    // Dates
    if (formData.has("startDate")) {
        const startStr = formData.get("startDate") as string;
        if (startStr) updateData.startDate = Timestamp.fromDate(new Date(startStr));
    }

    if (formData.has("endDate")) {
        const endStr = formData.get("endDate") as string;
        updateData.endDate = endStr ? Timestamp.fromDate(new Date(endStr)) : null;
    }

    // Toggles
    if (formData.has("isActive")) {
        updateData.isActive = formData.get("isActive") === "on" || formData.get("isActive") === "true";
    }
    if (formData.has("isSelected")) {
        updateData.isSelected = formData.get("isSelected") === "on" || formData.get("isSelected") === "true";
    }

    // Execute update only if there's actual data to push
    if (Object.keys(updateData).length > 1) {
        await db
            .collection("users")
            .doc(session.user.id)
            .collection("education")
            .doc(educationId)
            .update({...updateData})
    }

    revalidatePath("/test")
}

// --- 3. DELETE ---
export async function deleteEducation(educationId: string) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    await db
        .collection("users")
        .doc(session.user.id)
        .collection("education")
        .doc(educationId)
        .delete()

    revalidatePath("/test")
}