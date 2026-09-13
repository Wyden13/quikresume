"use server"

import { auth } from "@/auth"
import { db } from "@/lib/firestore"
import { revalidatePath } from "next/cache"
import { Timestamp, type DocumentReference, type WriteBatch } from "firebase-admin/firestore";
import type { ResumeData } from "@/types/schema"
import { PRESENT, toUtcDate } from "@/lib/dates";
import { isTempId } from "@/lib/ids";
import { toBullets } from "@/lib/typst/doc";

// Firestore allows at most 500 writes per batch.
const BATCH_LIMIT = 450;

const toTimestamp = (s: string | null | undefined): Timestamp | null => {
    const d = toUtcDate(s);
    return d ? Timestamp.fromDate(d) : null;
};

const orNull = (s: string | null | undefined): string | null => (s && s.trim() !== "" ? s.trim() : null);

/**
 * Persists the editor draft: personal info onto the user document, and every
 * list item into its subcollection. Items with a temporary id (see
 * src/lib/ids.ts) get a new Firestore document; others are merged by id.
 * Deletions are performed immediately by the editor, not here.
 */
export async function saveResumeData(data: ResumeData) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const userRef = db.collection("users").doc(session.user.id);
    const now = Timestamp.now();

    const writes: Array<(batch: WriteBatch) => void> = [];
    const docFor = (collection: string, id: string): DocumentReference =>
        isTempId(id) ? userRef.collection(collection).doc() : userRef.collection(collection).doc(id);
    const withMeta = (id: string, fields: Record<string, unknown>) => ({
        ...fields,
        updatedAt: now,
        ...(isTempId(id) ? { createdAt: now } : {}),
    });

    const p = data.personalInfo;
    writes.push(batch => batch.set(userRef, {
        firstName: p.firstName.trim(),
        lastName: p.lastName.trim(),
        headline: orNull(p.headline),
        professionalEmail: orNull(p.email),
        phoneNumber: orNull(p.phone),
        location: orNull(p.location),
        github: orNull(p.github),
        linkedIn: orNull(p.linkedin),
        website: orNull(p.website),
        bio: orNull(p.summary),
        updatedAt: now,
    }, { merge: true }));

    for (const exp of data.workExperience) {
        const ref = docFor("experience", exp.id);
        writes.push(batch => batch.set(ref, withMeta(exp.id, {
            position: exp.title.trim() || "Untitled Role",
            company: exp.company.trim() || "Unknown Company",
            startDate: toTimestamp(exp.startDate),
            endDate: exp.endDate === PRESENT ? null : toTimestamp(exp.endDate),
            isActive: exp.endDate === PRESENT,
            isSelected: exp.isSelected ?? true,
            description: toBullets(exp.description),
        }), { merge: true }));
    }

    for (const edu of data.education) {
        const ref = docFor("education", edu.id);
        writes.push(batch => batch.set(ref, withMeta(edu.id, {
            programName: edu.degree.trim() || "Untitled Program",
            schoolName: edu.institution.trim() || "Unknown Institution",
            startDate: toTimestamp(edu.startDate),
            endDate: edu.endDate === PRESENT ? null : toTimestamp(edu.endDate),
            isActive: edu.endDate === PRESENT,
            isSelected: edu.isSelected ?? true,
            gpa: orNull(edu.gpa),
            minorName: orNull(edu.minor),
            details: orNull(edu.details),
        }), { merge: true }));
    }

    for (const skill of data.skills) {
        const ref = docFor("skills", skill.id);
        writes.push(batch => batch.set(ref, withMeta(skill.id, {
            category: skill.category.trim() || "General",
            items: skill.items.trim(),
            isSelected: skill.isSelected ?? true,
        }), { merge: true }));
    }

    for (const project of data.projects) {
        const ref = docFor("projects", project.id);
        writes.push(batch => batch.set(ref, withMeta(project.id, {
            title: project.title.trim() || "Untitled Project",
            stack: orNull(project.stack),
            link: orNull(project.link),
            startDate: toTimestamp(project.startDate),
            endDate: project.endDate === PRESENT ? null : toTimestamp(project.endDate),
            isActive: project.endDate === PRESENT,
            isSelected: project.isSelected ?? true,
            description: toBullets(project.description),
        }), { merge: true }));
    }

    for (const cert of data.certifications) {
        const ref = docFor("certifications", cert.id);
        writes.push(batch => batch.set(ref, withMeta(cert.id, {
            name: cert.name.trim() || "Untitled Certification",
            issuer: orNull(cert.issuer),
            year: cert.year.trim(),
            isSelected: cert.isSelected ?? true,
        }), { merge: true }));
    }

    try {
        for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
            const batch = db.batch();
            for (const write of writes.slice(i, i + BATCH_LIMIT)) write(batch);
            await batch.commit();
        }

        revalidatePath("/dashboard");
        return { success: true };
    } catch (error: unknown) {
        console.error("Error in saveResumeData:", error);
        throw new Error(error instanceof Error ? error.message : "Failed to sync library");
    }
}
