// src/lib/match/resume-body.ts
// Shape check for a ResumeData sent over the wire to the Job Match routes.

import { RESUME_LIST_KEYS, type ResumeData } from "@/types/schema";

export function isResumeData(v: unknown): v is ResumeData {
    if (!v || typeof v !== "object") return false;
    const o = v as Record<string, unknown>;
    return typeof o.personalInfo === "object" && o.personalInfo !== null && RESUME_LIST_KEYS.every(k => Array.isArray(o[k]));
}
