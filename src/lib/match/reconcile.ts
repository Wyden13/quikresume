// src/lib/match/reconcile.ts
// Server-only: the "broader context" pass of Job Match. Exact tag matching
// misses what a human sees at once ("Bachelor of Science" satisfies
// "Bachelor's degree", five systems projects evidence "Computer Science", a
// "5-service architecture" is microservices). This asks the text model to
// reconcile the requirements that found no exact tag against the candidate's
// whole tag inventory and items, and writes the verdicts onto the
// requirements (`satisfiedBy`, `evidence`, `reason`) so the deterministic
// scorer (lib/match/score.ts) honours them on every client-side recompute.
//
// Never throws for model trouble: on failure the requirements come back
// unchanged (built-in hierarchy still applies) and `warning` is set.

import "server-only";
import type { ResumeData, ResumeListKey } from "@/types/schema";
import { RESUME_LIST_KEYS } from "@/types/schema";
import { chatCompletion, GlmError, textModel } from "@/lib/glm/client";
import { extractJson, ImportParseError } from "@/lib/import/parsed-resume";
import { aggregateTags } from "@/lib/tags/aggregate";
import { canonicalKey, type AliasMap } from "@/lib/tags/normalize";
import { itemTitle } from "@/lib/sections";
import { toBullets } from "@/lib/typst/doc";
import { RECONCILE_SYSTEM_PROMPT, reconcileUserMessage, type ProposalPromptItem, type ReconcileTagRow } from "@/lib/match/prompt";
import type { Requirement } from "@/lib/match/types";

const MAX_TAGS = 400;
const MAX_ITEMS = 120;
const MAX_BULLETS = 6;
const MAX_BULLET_CHARS = 220;

export interface ReconcileResult {
    requirements: Requirement[];
    /** Requirement keys whose verdict changed in this pass. */
    changed: string[];
    warning?: string;
}

/** Items the model may cite: the whole library (selection is irrelevant for "does the candidate have it"). */
export function reconcileItems(resume: ResumeData): ProposalPromptItem[] {
    const items: ProposalPromptItem[] = [];
    for (const key of RESUME_LIST_KEYS) {
        for (const item of resume[key] as ResumeData[ResumeListKey][number][]) {
            const bullets = "description" in item
                ? toBullets(item.description).slice(0, MAX_BULLETS).map(b => b.slice(0, MAX_BULLET_CHARS))
                : "details" in item && item.details ? [item.details.slice(0, MAX_BULLET_CHARS)] : "items" in item ? [item.items.slice(0, 400)] : [];
            items.push({ id: item.id, section: key, label: itemTitle(key, item), bullets, tags: item.tags.map(t => t.display) });
        }
    }
    return items.slice(0, MAX_ITEMS);
}

export async function reconcileRequirements(
    requirements: Requirement[],
    resume: ResumeData,
    aliases: AliasMap,
    /** Routes with a time budget pass a shorter timeout and no retry. */
    opts: { timeoutMs?: number; retries?: number } = {},
): Promise<ReconcileResult> {
    const inventory = aggregateTags(resume, { selectedOnly: false });
    const tagByKey = new Map(inventory.map(t => [t.name, t]));
    const tagByDisplay = new Map(inventory.map(t => [t.display.toLowerCase(), t.name]));
    const items = reconcileItems(resume);
    const itemIds = new Set(items.map(i => i.id));

    // Every requirement goes in, even ones with an exact tag: an exact tag may sit on an
    // unselected item while the evidence the model cites is selected, and the scorer
    // only counts selected carriers.
    const cleared = (r: Requirement): Requirement => ({ ...r, satisfiedBy: [], evidence: [], reason: "" });
    if (requirements.length === 0 || items.length === 0) return { requirements: requirements.map(cleared), changed: [] };

    const candidateTags: ReconcileTagRow[] = inventory.slice(0, MAX_TAGS).map(t => ({ name: t.display, kind: t.kind, items: t.weight }));
    let matches: unknown;
    try {
        const result = await chatCompletion(
            [
                { role: "system", content: RECONCILE_SYSTEM_PROMPT },
                { role: "user", content: reconcileUserMessage({ requirements, candidateTags, items }) },
            ],
            { model: textModel(), json: true, effort: "low", temperature: 0.1, maxTokens: 6000, timeoutMs: opts.timeoutMs ?? 60_000, retries: opts.retries },
        );
        matches = (extractJson(result.text) as { matches?: unknown }).matches;
    } catch (err) {
        const warning = err instanceof ImportParseError ? "The AI match check could not be understood."
            : err instanceof GlmError ? err.message : "The AI match check failed.";
        console.error("[reconcile]", err instanceof ImportParseError ? err.raw.slice(0, 300) : err);
        return { requirements, changed: [], warning };
    }

    const byDisplay = new Map(requirements.map(r => [r.display.toLowerCase(), r]));
    const byKey = new Map(requirements.map(r => [r.name, r]));
    const verdicts = new Map<string, { satisfiedBy: string[]; evidence: string[]; reason: string }>();
    if (Array.isArray(matches)) {
        for (const raw of matches) {
            if (!raw || typeof raw !== "object") continue;
            const o = raw as Record<string, unknown>;
            if (typeof o.requirement !== "string") continue;
            const req = byDisplay.get(o.requirement.trim().toLowerCase()) ?? byKey.get(canonicalKey(o.requirement, aliases));
            if (!req) continue;
            const satisfiedBy = new Set<string>();
            for (const s of Array.isArray(o.satisfiedBy) ? o.satisfiedBy : []) {
                if (typeof s !== "string") continue;
                const key = tagByDisplay.get(s.trim().toLowerCase()) ?? canonicalKey(s, aliases);
                if (key && key !== req.name && tagByKey.has(key)) satisfiedBy.add(key);
            }
            const evidence = new Set<string>();
            for (const id of Array.isArray(o.evidence) ? o.evidence : []) if (typeof id === "string" && itemIds.has(id)) evidence.add(id);
            if (satisfiedBy.size === 0 && evidence.size === 0) continue;
            verdicts.set(req.name, {
                satisfiedBy: [...satisfiedBy].slice(0, 8),
                evidence: [...evidence].slice(0, 8),
                reason: typeof o.reason === "string" ? o.reason.trim().slice(0, 200) : "",
            });
        }
    }

    const changed: string[] = [];
    const out = requirements.map(r => {
        const v = verdicts.get(r.name);
        const next: Requirement = v ? { ...r, ...v } : cleared(r);
        if (JSON.stringify([r.satisfiedBy, r.evidence]) !== JSON.stringify([next.satisfiedBy, next.evidence])) changed.push(r.name);
        return next;
    });
    return { requirements: out, changed };
}
