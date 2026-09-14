// src/lib/about/types.ts
// "About you": the candidate characterization (users/{uid}/meta/characterization). Structured answers
// the user confirms, AI follow-up questions, and the condensed candidate brief every coaching / tailoring
// prompt receives. Pure and isomorphic.

export type EducationStatus = "in-school" | "graduated" | "no-degree" | "";
export type Seniority = "intern" | "entry" | "mid" | "senior" | "lead" | "manager" | "executive" | "";
export type WorkMode = "onsite" | "hybrid" | "remote";
export type Relocation = "yes" | "no" | "maybe" | "";
export type WorkAuthorization = "authorized" | "needs-sponsorship" | "prefer-not" | "";
export type CareerStage = "student" | "new-grad" | "early" | "mid" | "senior";
export type CharacterizationStatus = "draft" | "skipped" | "complete";

export interface CharacterizationAnswers {
    // Core
    field: string;
    /** Years of professional experience; null = unknown. */
    yearsExperience: number | null;
    /** "computed" while it still equals the value derived from the library dates. */
    yearsSource: "computed" | "user";
    educationStatus: EducationStatus;
    /** "YYYY-MM-01" (expected date while in school) or "". */
    graduationDate: string;
    targetRoles: string[];
    // Targeting
    targetSeniority: Seniority;
    targetIndustries: string[];
    locations: string[];
    workModes: WorkMode[];
    relocation: Relocation;
    workAuthorization: WorkAuthorization;
    authorizationCountry: string;
    // Narrative
    careerChange: { changing: boolean | null; from: string; to: string };
    gaps: { has: boolean | null; explanation: string };
    strengths: string[];
    emphasize: string;
    deEmphasize: string;
}

export interface FollowUp {
    id: string;
    question: string;
    /** Why the coach asks (shown as a hint). */
    why: string;
    answer: string;
}

export interface CandidateFacts {
    careerStage: CareerStage;
    yearsExperience: number | null;
    educationStatus: EducationStatus;
    graduation: string | null;
}

export interface Characterization {
    status: CharacterizationStatus | null;
    answers: CharacterizationAnswers;
    followUps: FollowUp[];
    /** coreHash the follow-up questions were generated from. */
    followUpsHash: string | null;
    answersHash: string | null;
    brief: string | null;
    /** answersHash the brief was generated from. */
    briefHash: string | null;
    briefAt: string | null;
    /** The last brief generation failed; `brief` is older than the answers. */
    briefStale: boolean;
    facts: CandidateFacts | null;
}

/** What prompts receive: the brief plus a few computed facts. */
export interface CandidatePromptContext {
    brief: string;
    briefHash: string;
    facts: CandidateFacts;
}

export const SENIORITY_OPTIONS: { value: Seniority; label: string }[] = [
    { value: "", label: "Not sure" },
    { value: "intern", label: "Internship / co-op" },
    { value: "entry", label: "Entry level / new grad" },
    { value: "mid", label: "Mid level" },
    { value: "senior", label: "Senior" },
    { value: "lead", label: "Lead / staff" },
    { value: "manager", label: "Manager" },
    { value: "executive", label: "Director / executive" },
];

export const EDUCATION_OPTIONS: { value: EducationStatus; label: string }[] = [
    { value: "", label: "Choose…" },
    { value: "in-school", label: "Still studying" },
    { value: "graduated", label: "Graduated" },
    { value: "no-degree", label: "No degree / not applicable" },
];

export const WORK_MODE_OPTIONS: { value: WorkMode; label: string }[] = [
    { value: "onsite", label: "On-site" },
    { value: "hybrid", label: "Hybrid" },
    { value: "remote", label: "Remote" },
];

export const RELOCATION_OPTIONS: { value: Relocation; label: string }[] = [
    { value: "", label: "Choose…" },
    { value: "yes", label: "Yes" },
    { value: "maybe", label: "For the right role" },
    { value: "no", label: "No" },
];

export const AUTHORIZATION_OPTIONS: { value: WorkAuthorization; label: string }[] = [
    { value: "", label: "Choose…" },
    { value: "authorized", label: "Authorized to work, no sponsorship needed" },
    { value: "needs-sponsorship", label: "Will need visa sponsorship" },
    { value: "prefer-not", label: "Prefer not to say" },
];

export function emptyAnswers(): CharacterizationAnswers {
    return {
        field: "", yearsExperience: null, yearsSource: "computed", educationStatus: "", graduationDate: "", targetRoles: [],
        targetSeniority: "", targetIndustries: [], locations: [], workModes: [], relocation: "", workAuthorization: "", authorizationCountry: "",
        careerChange: { changing: null, from: "", to: "" }, gaps: { has: null, explanation: "" }, strengths: [], emphasize: "", deEmphasize: "",
    };
}

export function emptyCharacterization(): Characterization {
    return { status: null, answers: emptyAnswers(), followUps: [], followUpsHash: null, answersHash: null, brief: null, briefHash: null, briefAt: null, briefStale: false, facts: null };
}

// ---------- lenient readers (Firestore docs and request bodies)

const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
const list = (v: unknown, maxItems = 10, max = 80) =>
    Array.isArray(v) ? [...new Set(v.map(x => str(x, max)).filter(Boolean))].slice(0, maxItems) : [];
const boolOrNull = (v: unknown) => (typeof v === "boolean" ? v : null);
const nullableStr = (v: unknown) => (typeof v === "string" && v ? v : null);
const isoOf = (v: unknown): string | null =>
    typeof v === "string" ? v : v && typeof (v as { toDate?: () => Date }).toDate === "function" ? (v as { toDate: () => Date }).toDate().toISOString() : null;

const STAGES: CareerStage[] = ["student", "new-grad", "early", "mid", "senior"];
const EDU: EducationStatus[] = ["in-school", "graduated", "no-degree", ""];

export function readAnswers(v: unknown): CharacterizationAnswers {
    const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    const cc = (o.careerChange && typeof o.careerChange === "object" ? o.careerChange : {}) as Record<string, unknown>;
    const gaps = (o.gaps && typeof o.gaps === "object" ? o.gaps : {}) as Record<string, unknown>;
    const years = typeof o.yearsExperience === "number" && Number.isFinite(o.yearsExperience) ? Math.max(0, Math.min(60, Math.round(o.yearsExperience * 2) / 2)) : null;
    return {
        field: str(o.field, 120),
        yearsExperience: years,
        yearsSource: o.yearsSource === "user" ? "user" : "computed",
        educationStatus: oneOf(o.educationStatus, EDU, ""),
        graduationDate: /^\d{4}-\d{2}-01$/.test(str(o.graduationDate)) ? str(o.graduationDate) : "",
        targetRoles: list(o.targetRoles, 6),
        targetSeniority: oneOf(o.targetSeniority, SENIORITY_OPTIONS.map(x => x.value), ""),
        targetIndustries: list(o.targetIndustries, 6),
        locations: list(o.locations, 6),
        workModes: Array.isArray(o.workModes) ? [...new Set(o.workModes.filter((m): m is WorkMode => m === "onsite" || m === "hybrid" || m === "remote"))] : [],
        relocation: oneOf(o.relocation, RELOCATION_OPTIONS.map(x => x.value), ""),
        workAuthorization: oneOf(o.workAuthorization, AUTHORIZATION_OPTIONS.map(x => x.value), ""),
        authorizationCountry: str(o.authorizationCountry, 60),
        careerChange: { changing: boolOrNull(cc.changing), from: str(cc.from, 120), to: str(cc.to, 120) },
        gaps: { has: boolOrNull(gaps.has), explanation: str(gaps.explanation, 600) },
        strengths: list(o.strengths, 5),
        emphasize: str(o.emphasize, 600),
        deEmphasize: str(o.deEmphasize, 600),
    };
}

export function readFollowUps(v: unknown): FollowUp[] {
    if (!Array.isArray(v)) return [];
    const out: FollowUp[] = [];
    for (const r of v.slice(0, 5)) {
        if (!r || typeof r !== "object") continue;
        const o = r as Record<string, unknown>;
        const question = str(o.question, 240);
        if (!question) continue;
        out.push({ id: str(o.id, 40) || `q${out.length + 1}`, question, why: str(o.why, 240), answer: str(o.answer, 1000) });
    }
    return out;
}

export function readFacts(v: unknown): CandidateFacts | null {
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    if (!STAGES.includes(o.careerStage as CareerStage)) return null;
    return {
        careerStage: o.careerStage as CareerStage,
        yearsExperience: typeof o.yearsExperience === "number" ? o.yearsExperience : null,
        educationStatus: oneOf(o.educationStatus, EDU, ""),
        graduation: nullableStr(o.graduation),
    };
}

export function readCharacterization(raw: Record<string, unknown>): Characterization {
    const status = raw.status === "draft" || raw.status === "skipped" || raw.status === "complete" ? raw.status : null;
    return {
        status,
        answers: readAnswers(raw.answers),
        followUps: readFollowUps(raw.followUps),
        followUpsHash: nullableStr(raw.followUpsHash),
        answersHash: nullableStr(raw.answersHash),
        brief: nullableStr(raw.brief),
        briefHash: nullableStr(raw.briefHash),
        briefAt: isoOf(raw.briefAt),
        briefStale: raw.briefStale === true,
        facts: readFacts(raw.facts),
    };
}
