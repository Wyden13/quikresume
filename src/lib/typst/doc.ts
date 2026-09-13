// src/lib/typst/doc.ts
// The JSON contract between the app and the Typst templates. This is the ONLY
// place the app shapes resume data for Typst: it filters `isSelected`, formats
// dates, splits bullet text, and guarantees every field is a string (never
// null/undefined) so templates can simply test `x != ""`.
//
// Templates receive this object via `sys.inputs.resume` and must not do any
// filtering or date logic of their own; they are pure styling.

import { formatDateRange, formatMonthYear } from "@/lib/dates";
import { bulletEntries, skillEntries, visible } from "@/lib/sub-items";
import type { PersonalInfo, ResumeData } from "@/types/schema";

export interface TypstHeader {
    name: string;
    tagline: string;
    location: string;
    phone: string;
    email: string;
    github: string;
    linkedin: string;
    website: string;
}

export interface TypstEducation {
    title: string;
    institution: string;
    date: string;
    gpa: string;
    minor: string;
    details: string;
}

export interface TypstSkill {
    label: string;
    value: string;
}

export interface TypstProject {
    title: string;
    stack: string;
    date: string;
    link: string;
    bullets: string[];
}

export interface TypstExperience {
    title: string;
    company: string;
    date: string;
    bullets: string[];
}

export interface TypstCertification {
    name: string;
    issuer: string;
    year: string;
}

export interface TypstAward {
    title: string;
    issuer: string;
    date: string;
    description: string;
}

export interface TypstVolunteering {
    title: string;
    organization: string;
    date: string;
    bullets: string[];
}

export interface TypstPublication {
    title: string;
    venue: string;
    date: string;
    link: string;
    authors: string;
}

export interface TypstLanguage {
    language: string;
    proficiency: string;
}

export interface TypstResumeDoc {
    header: TypstHeader;
    summary: string;
    education: TypstEducation[];
    skills: TypstSkill[];
    projects: TypstProject[];
    experience: TypstExperience[];
    volunteering: TypstVolunteering[];
    publications: TypstPublication[];
    awards: TypstAward[];
    certifications: TypstCertification[];
    languages: TypstLanguage[];
}

const s = (v: string | null | undefined): string => (v ?? "").trim();

/** Newline-separated text -> trimmed, non-empty bullet strings (leading "- " / "• " stripped). */
export function toBullets(text: string | null | undefined): string[] {
    return (text ?? "")
        .split("\n")
        .map(line => line.trim().replace(/^[-•*]\s+/, ""))
        .filter(line => line !== "");
}

/** Bullets minus the ones switched off individually. */
const shownBullets = (text: string, hidden: readonly string[] | undefined) =>
    visible(bulletEntries(toBullets(text)), hidden).map(e => e.label);

export function toTypstDoc(data: ResumeData): TypstResumeDoc {
    const p = data.personalInfo;
    return {
        header: {
            name: [s(p.firstName), s(p.lastName)].filter(Boolean).join(" "),
            tagline: s(p.headline),
            location: s(p.location),
            phone: s(p.phone),
            email: s(p.email),
            github: s(p.github),
            linkedin: s(p.linkedin),
            website: s(p.website),
        },
        summary: s(p.summary),
        education: data.education
            .filter(e => e.isSelected)
            .map(e => ({
                title: s(e.degree),
                institution: s(e.institution),
                date: formatDateRange(e.startDate, e.endDate),
                gpa: s(e.gpa),
                minor: s(e.minor),
                details: s(e.details),
            })),
        skills: data.skills
            .filter(k => k.isSelected)
            .flatMap(k => {
                const all = skillEntries(k.items);
                const shown = visible(all, k.hidden);
                // A category whose skills are all switched off disappears.
                return all.length > 0 && shown.length === 0 ? [] : [{ label: s(k.category), value: shown.map(e => e.label).join(", ") }];
            }),
        projects: data.projects
            .filter(pr => pr.isSelected)
            .map(pr => ({
                title: s(pr.title),
                stack: s(pr.stack),
                date: formatDateRange(pr.startDate, pr.endDate),
                link: s(pr.link),
                bullets: shownBullets(pr.description, pr.hidden),
            })),
        experience: data.workExperience
            .filter(x => x.isSelected)
            .map(x => ({
                title: s(x.title),
                company: s(x.company),
                date: formatDateRange(x.startDate, x.endDate),
                bullets: shownBullets(x.description, x.hidden),
            })),
        volunteering: data.volunteering
            .filter(v => v.isSelected)
            .map(v => ({
                title: s(v.role),
                organization: s(v.organization),
                date: formatDateRange(v.startDate, v.endDate),
                bullets: shownBullets(v.description, v.hidden),
            })),
        publications: data.publications
            .filter(pub => pub.isSelected)
            .map(pub => ({
                title: s(pub.title),
                venue: s(pub.venue),
                date: formatMonthYear(pub.date),
                link: s(pub.link),
                authors: s(pub.authors),
            })),
        awards: data.awards
            .filter(a => a.isSelected)
            .map(a => ({
                title: s(a.title),
                issuer: s(a.issuer),
                date: formatMonthYear(a.date),
                description: s(a.description),
            })),
        certifications: data.certifications
            .filter(c => c.isSelected)
            .map(c => ({ name: s(c.name), issuer: s(c.issuer), year: s(c.year) })),
        languages: data.languages
            .filter(l => l.isSelected)
            .map(l => ({ language: s(l.language), proficiency: s(l.proficiency) })),
    };
}

/** "First_Last_Resume.pdf" with unsafe characters stripped; "Resume.pdf" if no name. */
export function pdfFileName(p: PersonalInfo): string {
    const clean = (v: string) => v.trim().replace(/[^A-Za-z0-9-]+/g, "");
    const parts = [clean(p.firstName), clean(p.lastName)].filter(Boolean);
    return `${[...parts, "Resume"].join("_")}.pdf`;
}
