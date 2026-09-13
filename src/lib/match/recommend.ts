// src/lib/match/recommend.ts
// Greedy weighted set cover: which library items best cover a job's
// requirements under per-section caps. Deterministic; the LLM only adds
// wording later. Pure.

import type { ResumeData, ResumeListKey } from "@/types/schema";
import { RESUME_LIST_KEYS } from "@/types/schema";
import { itemRecency, itemTitle } from "@/lib/sections";
import type { Caps, Proposal, Requirement } from "@/lib/match/types";

const REQ_WEIGHT = { must: 3, nice: 1 } as const;
/** A requirement is "saturated" after this many carriers (matches the scoring curve). */
const NEED = 2;

interface Candidate {
    key: ResumeListKey;
    id: string;
    label: string;
    tagNames: Set<string>;
    recency: string;
    selected: boolean;
    initialGain: number;
}

export interface Recommendation {
    /** Ids the algorithm would include. */
    chosen: Set<string>;
    include: Proposal[];
    exclude: Proposal[];
    /** Requirement keys with at least one chosen carrier. */
    covered: Set<string>;
    uncovered: Requirement[];
}

export function recommendSelection(requirements: Requirement[], data: ResumeData, caps: Caps): Recommendation {
    const reqByName = new Map(requirements.map(r => [r.name, r]));
    const need = new Map<string, number>(requirements.map(r => [r.name, NEED]));
    const gainOf = (c: Candidate) => {
        let g = 0;
        for (const t of c.tagNames) {
            const n = need.get(t);
            if (n && n > 0) g += REQ_WEIGHT[reqByName.get(t)!.importance];
        }
        return g;
    };

    const candidates: Candidate[] = [];
    for (const key of RESUME_LIST_KEYS) {
        for (const item of data[key] as ResumeData[ResumeListKey][number][]) {
            const c: Candidate = {
                key, id: item.id, label: itemTitle(key, item),
                tagNames: new Set(item.tags.map(t => t.name)),
                recency: itemRecency(key, item), selected: item.isSelected, initialGain: 0,
            };
            c.initialGain = gainOf(c);
            candidates.push(c);
        }
    }

    const chosen = new Set<string>();
    const count: Partial<Record<ResumeListKey, number>> = {};
    const underCap = (key: ResumeListKey) => caps[key] === null || (count[key] ?? 0) < (caps[key] as number);
    const take = (c: Candidate) => {
        chosen.add(c.id);
        count[c.key] = (count[c.key] ?? 0) + 1;
        for (const t of c.tagNames) {
            const n = need.get(t);
            if (n && n > 0) need.set(t, n - 1);
        }
    };

    // Greedy loop.
    for (;;) {
        let best: Candidate | null = null;
        let bestGain = 0;
        let bestDistinct = 0;
        for (const c of candidates) {
            if (chosen.has(c.id) || !underCap(c.key)) continue;
            const g = gainOf(c);
            if (g <= 0) continue;
            const distinct = [...c.tagNames].filter(t => (need.get(t) ?? 0) > 0).length;
            const better =
                g > bestGain ||
                (g === bestGain && (distinct > bestDistinct ||
                    (distinct === bestDistinct && best !== null && (c.recency > best.recency || (c.recency === best.recency && c.selected && !best.selected)))));
            if (better) { best = c; bestGain = g; bestDistinct = distinct; }
        }
        if (!best) break;
        take(best);
    }

    // Every skills category that carries at least one requirement is included (uncapped, cheap on space).
    for (const c of candidates) if (c.key === "skills" && !chosen.has(c.id) && c.initialGain > 0) take(c);

    // A resume needs an education entry: keep the most recent one if none was picked.
    const education = candidates.filter(c => c.key === "education");
    if (education.length > 0 && !education.some(c => chosen.has(c.id))) {
        const newest = [...education].sort((a, b) => (b.recency > a.recency ? 1 : b.recency < a.recency ? -1 : 0))[0];
        take(newest);
    }

    const covered = new Set<string>();
    for (const c of candidates) if (chosen.has(c.id)) c.tagNames.forEach(t => { if (reqByName.has(t)) covered.add(t); });
    const uncovered = requirements.filter(r => !covered.has(r.name));

    const reqLabel = (names: string[]) => names.map(n => reqByName.get(n)?.display ?? n);
    const include: Proposal[] = [];
    const exclude: Proposal[] = [];
    for (const c of candidates) {
        const reqs = [...c.tagNames].filter(t => reqByName.has(t));
        if (chosen.has(c.id) && !c.selected) {
            include.push({
                id: `include-${c.id}`, kind: "include", section: c.key, itemId: c.id, itemLabel: c.label, tags: reqs,
                reason: reqs.length ? `Covers ${reqLabel(reqs).join(", ")}.` : "Keeps the resume complete.", status: "open",
            });
        } else if (!chosen.has(c.id) && c.selected && c.key !== "education" && caps[c.key] !== null) {
            const over = (count[c.key] ?? 0) >= (caps[c.key] as number);
            if (c.initialGain === 0 || over) {
                exclude.push({
                    id: `exclude-${c.id}`, kind: "exclude", section: c.key, itemId: c.id, itemLabel: c.label, tags: reqs,
                    reason: c.initialGain === 0
                        ? "Matches none of the job's requirements; dropping it makes room."
                        : `Over the ${caps[c.key]}-item limit for this section; other items cover its keywords (${reqLabel(reqs).join(", ")}).`,
                    status: "open",
                });
            }
        }
    }
    return { chosen, include, exclude, covered, uncovered };
}
