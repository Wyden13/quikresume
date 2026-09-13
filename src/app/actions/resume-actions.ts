"use server"

import { auth } from "@/auth"
import { db } from "@/lib/firestore"
import { revalidatePath } from "next/cache"
import { Timestamp, type DocumentReference, type WriteBatch } from "firebase-admin/firestore";
import type { ResumeData } from "@/types/schema"
import { PRESENT, toUtcDate } from "@/lib/dates";
import { isTempId } from "@/lib/ids";
import { toBullets } from "@/lib/typst/doc";
import { personalInfoToUserDoc } from "@/lib/resume-mapper";
import { contentHashOf, PROFILE_ID, profileHashOf, staleInputs, tagContext } from "@/lib/tags/content";
import { extractTags, TagError } from "@/lib/tags/extract";
import { mergeTagAliases, readTagAliases } from "@/lib/db/meta";
import type { Tag } from "@/lib/tags/types";
import type { ResumeListKey } from "@/types/schema";

// Firestore allows at most 500 writes per batch.
const BATCH_LIMIT = 450;

const toTimestamp = (s: string | null | undefined): Timestamp | null => {
    const d = toUtcDate(s);
    return d ? Timestamp.fromDate(d) : null;
};

const orNull = (s: string | null | undefined): string | null => (s && s.trim() !== "" ? s.trim() : null);

export interface SaveResult {
    success: true;
    /** Number of items whose smart tags were (re)extracted. */
    tagged: number;
    /** Set when the save went through but tag extraction failed or ran out of time. */
    tagWarning?: string;
}

/**
 * Persists the editor draft: personal info onto the user document, and every
 * list item into its subcollection. Items with a temporary id (see
 * src/lib/ids.ts) get a new Firestore document; others are merged by id.
 * Deletions are performed immediately by the editor, not here.
 *
 * Smart tags: items whose content hash no longer matches `tagsHash` are sent
 * to the GLM tagger first (one batched call per 20 items). A tagging failure
 * never blocks the save; those items simply stay stale.
 */
export async function saveResumeData(data: ResumeData): Promise<SaveResult> {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")
    const uid = session.user.id;

    const userRef = db.collection("users").doc(uid);
    const now = Timestamp.now();

    // --- smart tags for changed / new items
    const stale = staleInputs(data);
    let tagsById: Record<string, Tag[]> = {};
    let newAliases: Record<string, string> = {};
    let tagWarning: string | undefined;
    if (stale.length > 0) {
        try {
            const result = await extractTags(stale, await readTagAliases(uid), { context: tagContext(data) });
            tagsById = result.tagsById;
            newAliases = result.aliases;
            if (result.skipped.length > 0) {
                tagWarning = `${result.skipped.length} ${result.skipped.length === 1 ? "item was" : "items were"} not analysed in time; they will be picked up on your next save or from Insights.`;
            }
        } catch (err) {
            console.error("[save] tag extraction failed:", err);
            tagWarning = err instanceof TagError || err instanceof Error ? err.message : "Skill analysis failed.";
        }
    }
    const tagFields = (key: ResumeListKey, item: ResumeData[ResumeListKey][number]) => {
        const contentHash = contentHashOf(key, item);
        const fresh = tagsById[item.id];
        return fresh ? { contentHash, tags: fresh, tagsHash: contentHash, taggedAt: now } : { contentHash };
    };
    const profileFields = () => {
        const contentHash = profileHashOf(data.personalInfo);
        const fresh = tagsById[PROFILE_ID];
        return fresh
            ? { profileContentHash: contentHash, profileTags: fresh, profileTagsHash: contentHash, profileTaggedAt: now }
            : { profileContentHash: contentHash };
    };

    const writes: Array<(batch: WriteBatch) => void> = [];
    const docFor = (collection: string, id: string): DocumentReference =>
        isTempId(id) ? userRef.collection(collection).doc() : userRef.collection(collection).doc(id);
    const withMeta = (id: string, fields: Record<string, unknown>) => ({
        ...fields,
        updatedAt: now,
        ...(isTempId(id) ? { createdAt: now } : {}),
    });

    writes.push(batch => batch.set(userRef, {
        ...personalInfoToUserDoc(data.personalInfo),
        ...profileFields(),
        updatedAt: now,
    }, { merge: true }));

    for (const exp of data.workExperience) {
        const ref = docFor("experience", exp.id);
        writes.push(batch => batch.set(ref, withMeta(exp.id, {
            ...tagFields("workExperience", exp),
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
            ...tagFields("education", edu),
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
            ...tagFields("skills", skill),
            category: skill.category.trim() || "General",
            items: skill.items.trim(),
            isSelected: skill.isSelected ?? true,
        }), { merge: true }));
    }

    for (const project of data.projects) {
        const ref = docFor("projects", project.id);
        writes.push(batch => batch.set(ref, withMeta(project.id, {
            ...tagFields("projects", project),
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
            ...tagFields("certifications", cert),
            name: cert.name.trim() || "Untitled Certification",
            issuer: orNull(cert.issuer),
            year: cert.year.trim(),
            isSelected: cert.isSelected ?? true,
        }), { merge: true }));
    }

    for (const award of data.awards) {
        const ref = docFor("awards", award.id);
        writes.push(batch => batch.set(ref, withMeta(award.id, {
            ...tagFields("awards", award),
            title: award.title.trim() || "Untitled Award",
            issuer: orNull(award.issuer),
            date: toTimestamp(award.date),
            description: orNull(award.description),
            isSelected: award.isSelected ?? true,
        }), { merge: true }));
    }

    for (const vol of data.volunteering) {
        const ref = docFor("volunteering", vol.id);
        writes.push(batch => batch.set(ref, withMeta(vol.id, {
            ...tagFields("volunteering", vol),
            role: vol.role.trim() || "Untitled Role",
            organization: vol.organization.trim() || "Unknown Organization",
            startDate: toTimestamp(vol.startDate),
            endDate: vol.endDate === PRESENT ? null : toTimestamp(vol.endDate),
            isActive: vol.endDate === PRESENT,
            isSelected: vol.isSelected ?? true,
            description: toBullets(vol.description),
        }), { merge: true }));
    }

    for (const pub of data.publications) {
        const ref = docFor("publications", pub.id);
        writes.push(batch => batch.set(ref, withMeta(pub.id, {
            ...tagFields("publications", pub),
            title: pub.title.trim() || "Untitled Publication",
            venue: orNull(pub.venue),
            date: toTimestamp(pub.date),
            link: orNull(pub.link),
            authors: orNull(pub.authors),
            isSelected: pub.isSelected ?? true,
        }), { merge: true }));
    }

    for (const lang of data.languages) {
        const ref = docFor("languages", lang.id);
        writes.push(batch => batch.set(ref, withMeta(lang.id, {
            ...tagFields("languages", lang),
            language: lang.language.trim() || "Unknown Language",
            proficiency: orNull(lang.proficiency),
            isSelected: lang.isSelected ?? true,
        }), { merge: true }));
    }

    try {
        for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
            const batch = db.batch();
            for (const write of writes.slice(i, i + BATCH_LIMIT)) write(batch);
            await batch.commit();
        }

        await mergeTagAliases(uid, newAliases);
        revalidatePath("/dashboard");
        return { success: true, tagged: Object.keys(tagsById).length, tagWarning };
    } catch (error: unknown) {
        console.error("Error in saveResumeData:", error);
        throw new Error(error instanceof Error ? error.message : "Failed to sync library");
    }
}
