// src/lib/match/types.ts
// Job Match data model: analysed jobs, requirements, proposals, preferences.

import type { ResumeListKey } from "@/types/schema";
import type { TagKind } from "@/lib/tags/types";
import type { TagCarrier } from "@/lib/tags/aggregate";

export type Importance = "must" | "nice";

export interface Requirement {
    /** Normalised tag key (matches item tags). */
    name: string;
    display: string;
    kind: TagKind;
    importance: Importance;
    yearsMin: number | null;
    /**
     * Candidate tag keys that satisfy this requirement without being the same
     * key ("bachelor's degree" <- "bachelor of science"). Filled by the
     * reconcile pass (lib/match/reconcile.ts) against the candidate's library.
     */
    satisfiedBy: string[];
    /** Item ids the reconcile pass cited as demonstrating the requirement even without a tag. */
    evidence: string[];
    /** Short explanation from the reconcile pass ("" when it did nothing). */
    reason: string;
}

export type ProposalKind = "include" | "exclude" | "rewrite-bullet" | "add-skill" | "gap";
export type ProposalStatus = "open" | "applied" | "skipped" | "ignored";

export interface Proposal {
    id: string;
    kind: ProposalKind;
    section?: ResumeListKey;
    itemId?: string;
    itemLabel?: string;
    /** Requirement keys this proposal addresses. */
    tags: string[];
    /** rewrite-bullet: the exact current bullet line. add-skill: the category name. */
    current?: string;
    /** rewrite-bullet: the proposed line. add-skill: the skill to append. */
    proposed?: string;
    reason: string;
    status: ProposalStatus;
}

export interface JobRecord {
    id: string;
    title: string;
    company: string;
    source: { kind: "paste" | "file"; fileName: string | null };
    jdText: string;
    summary: string;
    requirements: Requirement[];
    proposals: Proposal[];
    proposalsAt: string | null;
    lastScore: number | null;
    /** Conflicts with the candidate's "About you" answers noticed while analysing (seniority, location, sponsorship). */
    fitNotes: string[];
    createdAt: string | null;
    updatedAt: string | null;
}

export interface MuteRule {
    kind: ProposalKind;
    tag?: string;
    itemId?: string;
}

/** null = uncapped. */
export type Caps = Record<ResumeListKey, number | null>;

export const DEFAULT_CAPS: Caps = {
    workExperience: 4,
    projects: 3,
    education: 2,
    skills: null,
    certifications: 3,
    awards: 3,
    volunteering: 3,
    publications: 3,
    languages: null,
};

/** A soft skill the user said they don't have (auto-tailor questionnaire). Warned about on later jobs until answered Yes. */
export interface DeclinedSkill {
    /** Requirement tag key. */
    name: string;
    display: string;
    at: string | null;
}

export interface Preferences {
    mutedProposals: MuteRule[];
    caps: Caps;
    declinedSoftSkills: DeclinedSkill[];
}

/** hard = named technologies, tools, credentials, languages (missing = disqualifying); soft = traits and practices (missing = keyword advice). */
export type RequirementTier = "hard" | "soft";

export interface MatchRow {
    requirement: Requirement;
    tier: RequirementTier;
    /** 0..1 */
    strength: number;
    /** True when at least one scored item covers the requirement (exact tag, satisfying tag or cited evidence). */
    tagHit: boolean;
    /** Number of distinct scored items covering the requirement. */
    weight: number;
    literalHit: boolean;
    items: TagCarrier[];
    /** Display names of the tags that covered it other than the exact key (e.g. "Bachelor of Science"). */
    via: string[];
    /** Reconcile-pass explanation when the hit is not an exact tag; "" otherwise. */
    reason: string;
}

export interface MatchResult {
    /** 0..100 */
    score: number;
    must: { hit: number; total: number };
    nice: { hit: number; total: number };
    rows: MatchRow[];
    /** Hard must-haves with no coverage at all: the disqualifiers. */
    missingMust: Requirement[];
    /** Soft requirements (traits / practices) with no coverage: keywords worth adding before applying. */
    keywordGaps: Requirement[];
}

/** Shape of one resume-side option in Job Match. */
export type ResumeSource =
    | { kind: "selection" }
    | { kind: "variant"; variantId: string }
    | { kind: "upload"; fileName: string };
