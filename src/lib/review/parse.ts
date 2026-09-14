// src/lib/review/parse.ts
// Lenient parsing of the review reply. Suggestions that can't be applied safely are dropped: unknown
// fields, a `current` that isn't in the item, empty / unchanged / placeholder rewrites. Pure.

import { stableHash } from "@/lib/hash";
import { bulletKey } from "@/lib/sub-items";
import { fieldSpec, type ReviewInput } from "./content";
import { REVIEW_FLAGS, type ReviewFlag, type ReviewSuggestion } from "./types";

export interface ParsedReview {
    score: number;
    flags: ReviewFlag[];
    comment: string;
    suggestions: ReviewSuggestion[];
}

const MAX_SUGGESTIONS = 3;

function parseSuggestion(input: ReviewInput, raw: unknown, context: string): ReviewSuggestion | null {
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    if (typeof o.field !== "string" || typeof o.current !== "string" || typeof o.proposed !== "string") return null;
    const spec = fieldSpec(input.target, o.field);
    const value = input.fields[o.field];
    if (!spec || value === undefined) return null;

    const proposed = o.proposed.replace(/\s+/g, " ").trim();
    let current = o.current.trim();
    if (spec.bullets) {
        const bullets = Array.isArray(value) ? value : [value];
        // Copy the stored spelling so the Library can find the bullet again.
        const match = bullets.find(b => bulletKey(b) === bulletKey(current));
        if (!match) return null;
        current = match;
    } else {
        const whole = Array.isArray(value) ? value.join("\n") : value;
        if (whole.trim() !== current) return null;
    }
    if (!proposed || proposed === current.replace(/\s+/g, " ").trim() || /[[\]]/.test(proposed)) return null;
    if (proposed.length > current.length * 2 + 80) return null;
    // A rewrite should not introduce digits the original didn't have (invented metrics).
    const digits = (s: string) => new Set(s.match(/\d+(?:[.,]\d+)?/g) ?? []);
    // The headline / summary may use the candidate brief (target role, graduation year).
    const known = digits(input.target === "profile" ? `${Object.values(input.fields).flat().join(" ")} ${context}` : current);
    if ([...digits(proposed)].some(d => !known.has(d))) return null;

    const reason = typeof o.reason === "string" ? o.reason.trim().slice(0, 200) : "";
    return { id: stableHash(`${o.field}|${current}|${proposed}`), field: o.field, current, proposed: proposed.slice(0, 600), reason };
}

/** `context`: the candidate brief the model saw (numbers from it are allowed in profile rewrites). */
export function parseReviewReply(json: unknown, inputs: ReviewInput[], context = ""): Record<string, ParsedReview> {
    const byId = new Map(inputs.map(i => [i.id, i]));
    const out: Record<string, ParsedReview> = {};
    const rows = json && typeof json === "object" ? (json as { reviews?: unknown }).reviews : null;
    if (!Array.isArray(rows)) return out;
    for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        const o = row as Record<string, unknown>;
        const input = typeof o.id === "string" ? byId.get(o.id) : undefined;
        if (!input || out[input.id] || typeof o.score !== "number" || !Number.isFinite(o.score)) continue;
        const suggestions: ReviewSuggestion[] = [];
        for (const s of Array.isArray(o.suggestions) ? o.suggestions : []) {
            const parsed = parseSuggestion(input, s, context);
            if (parsed && !suggestions.some(x => x.id === parsed.id || (x.field === parsed.field && x.current === parsed.current))) suggestions.push(parsed);
            if (suggestions.length >= MAX_SUGGESTIONS) break;
        }
        out[input.id] = {
            score: Math.max(0, Math.min(10, Math.round(o.score))),
            flags: [...new Set((Array.isArray(o.flags) ? o.flags : []).filter((f): f is ReviewFlag => (REVIEW_FLAGS as readonly unknown[]).includes(f)))],
            comment: typeof o.comment === "string" ? o.comment.trim().slice(0, 300) : "",
            suggestions,
        };
    }
    return out;
}
