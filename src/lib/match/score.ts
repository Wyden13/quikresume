// src/lib/match/score.ts
// Deterministic job-fit scoring. Pure: runs in the browser for the live panel
// and on the server for proposals.
//
//   strength(requirement) = covered ? min(1, 0.5 + 0.25 * weight)   // 1 item = 0.75, 2+ = 1
//                                     (credentials and languages: any carrier = 1; a degree is binary)
//                         : literal hit in the rendered text ? 0.5
//                         : 0
//   "covered" = a selected item carries the requirement's tag key, a key that
//   satisfies it (reconcile pass / built-in degree hierarchy) or was cited as
//   evidence by the reconcile pass (see lib/match/coverage.ts).
//   score = 100 * Σ(w · strength) / Σ w,  w = importance × tier
//     importance: must = 1, nice = 0.4
//     tier: hard (named technologies, tools, credentials, languages) = 1,
//           soft (traits and practices: "Analytical Thinking", "Documentation",
//           "Software Testing", "Software Development Lifecycle") = 0.3
//   so a missing trait dents the score while a missing language sinks it, and
//   one missing nice-to-have no longer costs a fixed 30 points. Missing hard
//   must-haves are reported as `missingMust` (the disqualifiers); missing soft
//   requirements as `keywordGaps` ("add this keyword before applying").

import type { ResumeData } from "@/types/schema";
import { RESUME_LIST_KEYS } from "@/types/schema";
import { emptyKindTotals, type KindTotals } from "@/lib/tags/aggregate";
import { surfaceForms, type AliasMap } from "@/lib/tags/normalize";
import { toTypstDoc } from "@/lib/typst/doc";
import { literalHit, renderedText } from "@/lib/match/text";
import { coverageItems, requirementCoverage } from "@/lib/match/coverage";
import type { MatchResult, MatchRow, Requirement, RequirementTier } from "@/lib/match/types";

export const IMPORTANCE_WEIGHT: Record<Requirement["importance"], number> = { must: 1, nice: 0.4 };
export const TIER_WEIGHT: Record<RequirementTier, number> = { hard: 1, soft: 0.3 };
const BINARY_KINDS = new Set<Requirement["kind"]>(["credential", "language"]);

/**
 * Generic engineering practices that postings list as "technical requirements"
 * but that no serious screen fails a candidate on. Treated as soft whatever
 * kind the JD model assigned. Keys are canonical tag keys.
 */
const PRACTICE_KEYS = new Set<string>([
    "software development lifecycle", "sdlc", "software development life cycle", "documentation", "technical documentation",
    "software testing", "testing", "code review", "code reviews", "debugging", "troubleshooting", "problem solving",
    "analytical thinking", "analytical skills", "communication", "written communication", "verbal communication", "collaboration",
    "teamwork", "version control", "best practices", "clean code", "software design", "design patterns", "requirements analysis",
    "requirements gathering", "technical writing", "attention to detail", "time management", "self-motivated", "mentoring",
    "leadership", "unit testing", "integration testing", "quality assurance", "continuous learning", "software engineering",
    "software development", "programming", "coding", "computer science fundamentals", "computer science",
]);

export function requirementTier(r: Requirement): RequirementTier {
    if (r.kind === "soft-skill" || r.kind === "methodology") return "soft";
    if (r.kind === "domain") return "soft";
    return PRACTICE_KEYS.has(r.name) && r.kind !== "credential" ? "soft" : "hard";
}

/** The document with every item selected (for "whole library" scoring). */
export function withAllSelected(data: ResumeData): ResumeData {
    const next: ResumeData = { ...data };
    for (const key of RESUME_LIST_KEYS) {
        (next[key] as unknown[]) = (data[key] as { isSelected: boolean }[]).map(it => ({ ...it, isSelected: true }));
    }
    return next;
}

export function scoreJob(requirements: Requirement[], data: ResumeData, aliases: AliasMap = {}): MatchResult {
    const coverage = requirementCoverage(requirements, coverageItems(data, true));
    const text = renderedText(toTypstDoc(data));

    const rows: MatchRow[] = requirements.map(r => {
        const cov = coverage.get(r.name);
        const weight = cov?.items.length ?? 0;
        const literal = literalHit(text, [r.display, ...surfaceForms(r.name, aliases)]);
        const strength = weight > 0 ? (BINARY_KINDS.has(r.kind) ? 1 : Math.min(1, 0.5 + 0.25 * weight)) : literal ? 0.5 : 0;
        const inferred = weight > 0 && (cov!.via.length > 0 || cov!.items.some(i => r.evidence.includes(i.id)));
        return {
            requirement: r, tier: requirementTier(r), strength, tagHit: weight > 0, weight, literalHit: literal, items: cov?.items ?? [],
            via: cov?.viaDisplay ?? [], reason: inferred ? r.reason : "",
        };
    });

    const must = rows.filter(r => r.requirement.importance === "must");
    const nice = rows.filter(r => r.requirement.importance === "nice");
    const weightOf = (r: MatchRow) => IMPORTANCE_WEIGHT[r.requirement.importance] * TIER_WEIGHT[r.tier];
    const total = rows.reduce((s, r) => s + weightOf(r), 0);
    const score = total > 0 ? rows.reduce((s, r) => s + weightOf(r) * r.strength, 0) / total : 0;

    const order = (r: MatchRow) => (r.requirement.importance === "must" ? 0 : 1);
    const tierOrder = (r: MatchRow) => (r.tier === "hard" ? 0 : 1);
    rows.sort((a, b) => order(a) - order(b) || tierOrder(a) - tierOrder(b) || a.strength - b.strength || a.requirement.display.localeCompare(b.requirement.display));

    return {
        score: Math.round(score * 100),
        must: { hit: must.filter(r => r.strength > 0).length, total: must.length },
        nice: { hit: nice.filter(r => r.strength > 0).length, total: nice.length },
        rows,
        missingMust: must.filter(r => r.strength === 0 && r.tier === "hard").map(r => r.requirement),
        keywordGaps: rows.filter(r => r.strength === 0 && r.tier === "soft").map(r => r.requirement),
    };
}

/**
 * Requirements nothing in the library covers (every item switched on): hard ones of any
 * importance plus soft keyword gaps. What the tailor window's questionnaire asks about.
 */
export function uncoveredRequirements(requirements: Requirement[], library: ResumeData, aliases: AliasMap = {}): Requirement[] {
    return scoreJob(requirements, withAllSelected(library), aliases).rows.filter(r => r.strength === 0).map(r => r.requirement);
}

/** Kind totals for the job side of a radar (must = 2, nice = 1). */
export function jobKindTotals(requirements: Requirement[]): KindTotals {
    const totals = emptyKindTotals();
    for (const r of requirements) totals[r.kind] += r.importance === "must" ? 2 : 1;
    return totals;
}
