// src/lib/match/score.ts
// Deterministic job-fit scoring. Pure: runs in the browser for the live panel
// and on the server for proposals.
//
//   strength(requirement) = tag hit ? min(1, 0.5 + 0.25 * weight)   // 1 item = 0.75, 2+ = 1
//                         : literal hit in the rendered text ? 0.5
//                         : 0
//   score = 100 * (0.7 * mean(strength over must-haves) + 0.3 * mean(over nice-to-haves))
//   (an empty group hands its share to the other)

import type { ResumeData } from "@/types/schema";
import { RESUME_LIST_KEYS } from "@/types/schema";
import { aggregateTags, emptyKindTotals, tagVector, type KindTotals } from "@/lib/tags/aggregate";
import { surfaceForms, type AliasMap } from "@/lib/tags/normalize";
import { toTypstDoc } from "@/lib/typst/doc";
import { literalHit, renderedText } from "@/lib/match/text";
import type { MatchResult, MatchRow, Requirement } from "@/lib/match/types";

export const MUST_WEIGHT = 0.7;

/** The document with every item selected (for "whole library" scoring). */
export function withAllSelected(data: ResumeData): ResumeData {
    const next: ResumeData = { ...data };
    for (const key of RESUME_LIST_KEYS) {
        (next[key] as unknown[]) = (data[key] as { isSelected: boolean }[]).map(it => ({ ...it, isSelected: true }));
    }
    return next;
}

export function scoreJob(requirements: Requirement[], data: ResumeData, aliases: AliasMap = {}): MatchResult {
    const vector = tagVector(aggregateTags(data, { selectedOnly: true }));
    const text = renderedText(toTypstDoc(data));

    const rows: MatchRow[] = requirements.map(r => {
        const hit = vector.get(r.name);
        const literal = literalHit(text, [r.display, ...surfaceForms(r.name, aliases)]);
        const strength = hit ? Math.min(1, 0.5 + 0.25 * hit.weight) : literal ? 0.5 : 0;
        return { requirement: r, strength, tagHit: Boolean(hit), weight: hit?.weight ?? 0, literalHit: literal, items: hit?.items ?? [] };
    });

    const must = rows.filter(r => r.requirement.importance === "must");
    const nice = rows.filter(r => r.requirement.importance === "nice");
    const mean = (xs: MatchRow[]) => (xs.length ? xs.reduce((s, r) => s + r.strength, 0) / xs.length : 0);
    let score: number;
    if (must.length && nice.length) score = MUST_WEIGHT * mean(must) + (1 - MUST_WEIGHT) * mean(nice);
    else if (must.length) score = mean(must);
    else if (nice.length) score = mean(nice);
    else score = 0;

    const order = (r: MatchRow) => (r.requirement.importance === "must" ? 0 : 1);
    rows.sort((a, b) => order(a) - order(b) || a.strength - b.strength || a.requirement.display.localeCompare(b.requirement.display));

    return {
        score: Math.round(score * 100),
        must: { hit: must.filter(r => r.strength > 0).length, total: must.length },
        nice: { hit: nice.filter(r => r.strength > 0).length, total: nice.length },
        rows,
        missingMust: must.filter(r => r.strength === 0).map(r => r.requirement),
    };
}

/** Kind totals for the job side of a radar (must = 2, nice = 1). */
export function jobKindTotals(requirements: Requirement[]): KindTotals {
    const totals = emptyKindTotals();
    for (const r of requirements) totals[r.kind] += r.importance === "must" ? 2 : 1;
    return totals;
}
