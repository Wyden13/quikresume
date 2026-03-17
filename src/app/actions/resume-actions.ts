"use server"

import { auth } from "@/auth"
import { db } from "@/lib/firestore"
import { revalidatePath } from "next/cache"
import { ResumeData } from "@/types/schema"
import { Timestamp } from "firebase-admin/firestore";

// Helper to safely parse dates
const safeTimestamp = (dateStr: string | null | undefined) => {
    if (!dateStr || dateStr === "" || dateStr === "Present") return null;
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return null;
        return Timestamp.fromDate(date);
    } catch {
        return null;
    }
};

export async function saveResumeData(data: ResumeData) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const userId = session.user.id;
    const batch = db.batch();

    console.log("Saving Resume Data for user:", userId);

    try {
        // 1. Update Personal Info in User Document
        const userRef = db.collection("users").doc(userId);
        
        const nameParts = data.personalInfo.fullName.split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        batch.set(userRef, {
            firstName,
            lastName,
            professionalEmail: data.personalInfo.email || null,
            phoneNumber: data.personalInfo.phone || null,
            location: data.personalInfo.location || null,
            bio: data.personalInfo.summary || null,
            updatedAt: Timestamp.now(),
        }, { merge: true });

        // 2. Sync Work Experience
        for (const exp of data.workExperience) {
            const isNew = exp.id.length < 15;
            const expRef = !isNew 
                ? userRef.collection("experience").doc(exp.id) 
                : userRef.collection("experience").doc(); 

            batch.set(expRef, {
                position: exp.title || "Untitled Role",
                company: exp.company || "Unknown Company",
                startDate: safeTimestamp(exp.startDate) || Timestamp.now(),
                endDate: safeTimestamp(exp.endDate),
                isActive: exp.endDate === "Present",
                isSelected: exp.isSelected ?? true,
                description: (exp.description || "").split("\n").filter(l => l.trim() !== ""),
                updatedAt: Timestamp.now(),
                ...(isNew ? { createdAt: Timestamp.now() } : {})
            }, { merge: true });
        }

        // 3. Sync Education
        for (const edu of data.education) {
            const isNew = edu.id.length < 15;
            const eduRef = !isNew 
                ? userRef.collection("education").doc(edu.id) 
                : userRef.collection("education").doc();

            // Handle year parsing (e.g., "2016 - 2020")
            const yearParts = edu.year.split("-");
            const startStr = yearParts[0]?.trim();
            const endStr = yearParts[1]?.trim();

            batch.set(eduRef, {
                programName: edu.degree || "Untitled Program",
                schoolName: edu.institution || "Unknown Institution",
                startDate: safeTimestamp(startStr) || Timestamp.now(),
                endDate: safeTimestamp(endStr),
                isActive: edu.year.toLowerCase().includes("present"),
                isSelected: edu.isSelected ?? true,
                gpa: edu.details || null,
                updatedAt: Timestamp.now(),
                ...(isNew ? { createdAt: Timestamp.now() } : {})
            }, { merge: true });
        }

        // 4. Sync Skills
        for (const skill of data.skills) {
            const isNew = skill.id.length < 15;
            const skillRef = !isNew 
                ? userRef.collection("skills").doc(skill.id) 
                : userRef.collection("skills").doc();
            
            batch.set(skillRef, {
                category: skill.category || "General",
                items: skill.items || "",
                isSelected: skill.isSelected ?? true,
                updatedAt: Timestamp.now(),
                ...(isNew ? { createdAt: Timestamp.now() } : {})
            }, { merge: true });
        }

        await batch.commit();
        console.log("Batch commit successful");

        revalidatePath("/dashboard");
        revalidatePath("/test");
        revalidatePath("/work-test");
        
        return { success: true };
    } catch (error: unknown) {
        console.error("Error in saveResumeData:", error);
        throw new Error(error instanceof Error ? error.message : "Failed to sync library");
    }
}
