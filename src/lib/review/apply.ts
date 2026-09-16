// src/lib/review/apply.ts
// Accepting a coach suggestion: the FormData for the section's update action (Library, instant save), or
// a pure edit of the item. Pure and isomorphic.

import type { PersonalInfo, ResumeData, ResumeListKey } from "@/types/schema";
import { toBullets } from "@/lib/typst/doc";
import { bulletKey } from "@/lib/sub-items";
import { fieldSpec } from "./content";
import type { ItemReview, ReviewSuggestion, ReviewTarget } from "./types";

type AnyItem = ResumeData[ResumeListKey][number];

const read = (source: object, field: string) => {
    const v = (source as Record<string, unknown>)[field];
    return typeof v === "string" ? v : "";
};

/** The suggestion still matches the item's text (an edit or an earlier accept may have changed it). */
export function suggestionApplies(target: ReviewTarget, source: AnyItem | PersonalInfo, s: ReviewSuggestion): boolean {
    const spec = fieldSpec(target, s.field);
    if (!spec) return false;
    const text = read(source, s.field);
    if (spec.bullets) return toBullets(text).some(b => bulletKey(b) === bulletKey(s.current));
    return text.trim() === s.current.trim();
}

export function visibleSuggestions(target: ReviewTarget, source: AnyItem | PersonalInfo, review: ItemReview | null | undefined): ReviewSuggestion[] {
    if (!review) return [];
    const dismissed = new Set(review.dismissed);
    return review.suggestions.filter(s => !dismissed.has(s.id) && suggestionApplies(target, source, s));
}

/** New field value (and `hidden`, when a switched-off bullet is reworded so it stays off). */
function nextValue(target: ReviewTarget, source: AnyItem | PersonalInfo, s: ReviewSuggestion): { value: string; hidden?: string[] } | null {
    const spec = fieldSpec(target, s.field);
    if (!spec || !suggestionApplies(target, source, s)) return null;
    if (!spec.bullets) return { value: s.proposed.trim() };
    const key = bulletKey(s.current);
    const bullets = toBullets(read(source, s.field)).map(b => (bulletKey(b) === key ? s.proposed.trim() : b));
    const hidden = (source as { hidden?: string[] }).hidden;
    return {
        value: bullets.join("\n"),
        hidden: hidden?.includes(key) ? hidden.map(h => (h === key ? bulletKey(s.proposed) : h)) : undefined,
    };
}

export function applySuggestionFormData(key: ResumeListKey, item: AnyItem, s: ReviewSuggestion): FormData | null {
    const next = nextValue(key, item, s);
    const spec = fieldSpec(key, s.field);
    if (!next || !spec) return null;
    const fd = new FormData();
    fd.set(spec.form, next.value);
    if (next.hidden) fd.set("hidden", JSON.stringify(next.hidden));
    return fd;
}

/** Editor accept: the patch for the item's updater (the draft, not Firestore). */
export function applySuggestionPatch<K extends ResumeListKey>(key: K, item: ResumeData[K][number], s: ReviewSuggestion): Partial<ResumeData[K][number]> | null {
    const next = nextValue(key, item, s);
    if (!next) return null;
    return { [s.field]: next.value, ...(next.hidden ? { hidden: next.hidden } : {}) } as Partial<ResumeData[K][number]>;
}

export function applySuggestionToItem<K extends ResumeListKey>(key: K, item: ResumeData[K][number], s: ReviewSuggestion): ResumeData[K][number] {
    const next = nextValue(key, item, s);
    if (!next) return item;
    return { ...item, [s.field]: next.value, ...(next.hidden ? { hidden: next.hidden } : {}) };
}

/** Profile accept: the headline / summary patch. */
export function applyProfileSuggestion(p: PersonalInfo, s: ReviewSuggestion): { headline?: string; summary?: string } | null {
    const next = nextValue("profile", p, s);
    if (!next || (s.field !== "headline" && s.field !== "summary")) return null;
    return { [s.field]: next.value };
}
