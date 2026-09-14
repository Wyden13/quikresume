// src/lib/about/library-summary.ts
// Compact views of the library for the "About you" prompts. Pure.

import type { ResumeData } from "@/types/schema";
import { orderedItems } from "@/lib/layout/order";
import { formatMonthYear } from "@/lib/dates";

export function recentRoles(data: ResumeData, limit = 5): { title: string; company: string; start: string; end: string }[] {
    return orderedItems("workExperience", data.workExperience, undefined)
        .slice(0, limit)
        .map(x => ({ title: x.title, company: x.company, start: formatMonthYear(x.startDate), end: formatMonthYear(x.endDate) }));
}

export function educationRows(data: ResumeData, limit = 4): { degree: string; institution: string; end: string }[] {
    return orderedItems("education", data.education, undefined)
        .slice(0, limit)
        .map(x => ({ degree: x.degree, institution: x.institution, end: formatMonthYear(x.endDate) }));
}

export const libraryIsEmpty = (data: ResumeData) =>
    data.workExperience.length + data.education.length + data.projects.length + data.skills.length === 0 && !data.personalInfo.headline.trim();
