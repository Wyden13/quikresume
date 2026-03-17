"use server"

import { auth } from "@/auth"
import { db } from "@/lib/firestore"
import { revalidatePath } from "next/cache"
import { ResumeData } from "@/types/schema"
import { Timestamp } from "firebase-admin/firestore";

export async function saveResumeData(data: ResumeData) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const userId = session.user.id;
    const batch = db.batch();

    // 1. Update Personal Info in User Document
    const userRef = db.collection("users").doc(userId);
    
    // Simple split for fullName if we want to sync with profile fields
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
    // For simplicity in this bulk update, we'll iterate. 
    // In a production app, we might handle deletions too.
    for (const exp of data.workExperience) {
        const expRef = exp.id.length > 15 
            ? userRef.collection("experience").doc(exp.id) 
            : userRef.collection("experience").doc(); // New doc if it's a temp ID

        batch.set(expRef, {
            position: exp.title,
            company: exp.company,
            startDate: exp.startDate ? Timestamp.fromDate(new Date(exp.startDate)) : Timestamp.now(),
            endDate: (exp.endDate && exp.endDate !== "Present") ? Timestamp.fromDate(new Date(exp.endDate)) : null,
            isActive: exp.endDate === "Present",
            isSelected: exp.isSelected,
            description: exp.description.split("\n").filter(l => l.trim() !== ""),
            updatedAt: Timestamp.now(),
        }, { merge: true });
    }

    // 3. Sync Education
    for (const edu of data.education) {
        const eduRef = edu.id.length > 15 
            ? userRef.collection("education").doc(edu.id) 
            : userRef.collection("education").doc();

        batch.set(eduRef, {
            programName: edu.degree,
            schoolName: edu.institution,
            startDate: edu.year.split("-")[0]?.trim() ? Timestamp.fromDate(new Date(edu.year.split("-")[0].trim())) : Timestamp.now(),
            endDate: edu.year.split("-")[1]?.trim() ? Timestamp.fromDate(new Date(edu.year.split("-")[1].trim())) : null,
            isActive: edu.year.toLowerCase().includes("present"),
            isSelected: edu.isSelected,
            gpa: edu.details || null,
            updatedAt: Timestamp.now(),
        }, { merge: true });
    }

    // 4. Sync Skills (Save as subcollection)
    for (const skill of data.skills) {
        const skillRef = skill.id.length > 15 
            ? userRef.collection("skills").doc(skill.id) 
            : userRef.collection("skills").doc();
        
        batch.set(skillRef, {
            category: skill.category,
            items: skill.items,
            isSelected: skill.isSelected,
            updatedAt: Timestamp.now(),
        }, { merge: true });
    }

    await batch.commit();

    revalidatePath("/dashboard");
    return { success: true };
}
