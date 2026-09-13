// src/lib/import/merge.ts
// Pure merge of a reviewed import into the editor draft. List items are
// appended (duplicates of existing items skipped by a normalised key);
// personal info fills empty fields unless `replacePersonal` is set.

import type { PersonalInfo, ResumeData, ResumeListKey } from "@/types/schema";
import { RESUME_LIST_KEYS } from "@/types/schema";

export interface ImportSelection {
    personalInfo: PersonalInfo | null;
    replacePersonal: boolean;
    items: Partial<{ [K in ResumeListKey]: ResumeData[K] }>;
}

export interface MergeResult {
    data: ResumeData;
    added: number;
    skipped: number;
}

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

/** Identity key used to skip re-importing an item that is already in the library. */
export function itemKey<K extends ResumeListKey>(key: K, item: ResumeData[K][number]): string {
    switch (key) {
        case "workExperience": { const x = item as ResumeData["workExperience"][number]; return norm(`${x.title}|${x.company}|${x.startDate}`); }
        case "education": { const x = item as ResumeData["education"][number]; return norm(`${x.degree}|${x.institution}`); }
        case "skills": { const x = item as ResumeData["skills"][number]; return norm(x.category); }
        case "projects": { const x = item as ResumeData["projects"][number]; return norm(x.title); }
        case "certifications": { const x = item as ResumeData["certifications"][number]; return norm(x.name); }
        case "awards": { const x = item as ResumeData["awards"][number]; return norm(`${x.title}|${x.issuer}`); }
        case "volunteering": { const x = item as ResumeData["volunteering"][number]; return norm(`${x.role}|${x.organization}`); }
        case "publications": { const x = item as ResumeData["publications"][number]; return norm(x.title); }
        case "languages": { const x = item as ResumeData["languages"][number]; return norm(x.language); }
    }
}

export function mergeImport(base: ResumeData, sel: ImportSelection): MergeResult {
    let added = 0, skipped = 0;
    const data: ResumeData = { ...base };

    for (const key of RESUME_LIST_KEYS) {
        const incoming = sel.items[key];
        if (!incoming || incoming.length === 0) continue;
        const existing = new Set((base[key] as ResumeData[typeof key][number][]).map(it => itemKey(key, it)));
        const fresh: ResumeData[typeof key][number][] = [];
        for (const item of incoming as ResumeData[typeof key][number][]) {
            const k = itemKey(key, item);
            if (existing.has(k)) { skipped++; continue; }
            existing.add(k);
            fresh.push(item);
            added++;
        }
        (data[key] as unknown[]) = [...(base[key] as unknown[]), ...fresh];
    }

    if (sel.personalInfo) {
        const merged = { ...base.personalInfo };
        for (const field of Object.keys(merged) as (keyof PersonalInfo)[]) {
            const incoming = sel.personalInfo[field]?.trim() ?? "";
            if (!incoming) continue;
            if (sel.replacePersonal || !merged[field].trim()) merged[field] = incoming;
        }
        data.personalInfo = merged;
    }

    return { data, added, skipped };
}
