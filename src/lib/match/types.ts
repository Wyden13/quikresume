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

export interface Preferences {
    mutedProposals: MuteRule[];
    caps: Caps;
}

export interface MatchRow {
    requirement: Requirement;
    /** 0..1 */
    strength: number;
    tagHit: boolean;
    /** Number of scored items carrying the tag. */
    weight: number;
    literalHit: boolean;
    items: TagCarrier[];
}

export interface MatchResult {
    /** 0..100 */
    score: number;
    must: { hit: number; total: number };
    nice: { hit: number; total: number };
    rows: MatchRow[];
    missingMust: Requirement[];
}

/** Shape of one resume-side option in Job Match. */
export type ResumeSource =
    | { kind: "selection" }
    | { kind: "variant"; variantId: string }
    | { kind: "upload"; fileName: string };
