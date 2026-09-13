// src/lib/resume-mapper.ts
// Pure mapping from the serialized Firestore rows (src/types/db.ts) to the
// editor model (src/types/schema.ts). Called on the server by the dashboard
// page so the client receives a complete ResumeData, personal info included.

import { PRESENT, toDateInputValue } from "@/lib/dates";
import type {
    CertificationItem,
    EducationItem,
    ExperienceItem,
    ProjectItem,
    SkillCategoryItem,
    UserProfile,
} from "@/types/db";
import type { ResumeData } from "@/types/schema";

export interface ResumeSources {
    profile: UserProfile | null;
    /** Display name from the auth session, used when the profile has no name yet. */
    fallbackName?: string | null;
    experiences: ExperienceItem[];
    educations: EducationItem[];
    skills: SkillCategoryItem[];
    projects: ProjectItem[];
    certifications: CertificationItem[];
}

const s = (v: string | null | undefined): string => v ?? "";

function splitName(profile: UserProfile | null, fallbackName?: string | null): { firstName: string; lastName: string } {
    if (profile?.firstName || profile?.lastName) {
        return { firstName: s(profile.firstName), lastName: s(profile.lastName) };
    }
    const parts = (fallbackName ?? "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: "", lastName: "" };
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

const endDateOf = (isActive: boolean, endDate: string | null) =>
    isActive ? PRESENT : toDateInputValue(endDate);

export function toResumeData(src: ResumeSources): ResumeData {
    const p = src.profile;
    return {
        personalInfo: {
            ...splitName(p, src.fallbackName),
            headline: s(p?.headline),
            email: s(p?.professionalEmail || p?.email),
            phone: s(p?.phoneNumber),
            location: s(p?.location),
            github: s(p?.github),
            linkedin: s(p?.linkedIn),
            website: s(p?.website),
            summary: s(p?.bio),
        },
        workExperience: src.experiences.map(e => ({
            id: e.id,
            title: e.position,
            company: e.company,
            startDate: toDateInputValue(e.startDate),
            endDate: endDateOf(e.isActive, e.endDate),
            description: e.description.join("\n"),
            isSelected: e.isSelected,
        })),
        education: src.educations.map(e => ({
            id: e.id,
            degree: e.programName,
            institution: e.schoolName,
            startDate: toDateInputValue(e.startDate),
            endDate: endDateOf(e.isActive, e.endDate),
            gpa: s(e.gpa),
            minor: s(e.minorName),
            details: s(e.details),
            isSelected: e.isSelected,
        })),
        skills: src.skills.map(k => ({
            id: k.id,
            category: k.category,
            items: k.items,
            isSelected: k.isSelected,
        })),
        projects: src.projects.map(pr => ({
            id: pr.id,
            title: pr.title,
            stack: s(pr.stack),
            link: s(pr.link),
            startDate: toDateInputValue(pr.startDate),
            endDate: endDateOf(pr.isActive, pr.endDate),
            description: pr.description.join("\n"),
            isSelected: pr.isSelected,
        })),
        certifications: src.certifications.map(c => ({
            id: c.id,
            name: c.name,
            issuer: s(c.issuer),
            year: c.year,
            isSelected: c.isSelected,
        })),
    };
}
