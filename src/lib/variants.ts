// src/lib/variants.ts
// Pure helpers for resume variants (saved selections). A variant stores item
// ids per Firestore collection; the dashboard's `isSelected` flags remain the
// working selection that a variant is snapshotted from / loaded into.

import type { ResumeData, ResumeListKey } from "@/types/schema";
import { RESUME_LIST_KEYS } from "@/types/schema";
import type { ResumeVariant } from "@/types/db";
import { COLLECTION_NAMES, SECTION_COLLECTION, type CollectionName } from "@/lib/sections";

export type VariantItems = Record<CollectionName, string[]>;

export function emptyVariantItems(): VariantItems {
    return Object.fromEntries(COLLECTION_NAMES.map(c => [c, []])) as unknown as VariantItems;
}

/** Ids of every selected item, grouped by collection. */
export function selectedIds(data: ResumeData): VariantItems {
    const out = emptyVariantItems();
    for (const key of RESUME_LIST_KEYS) {
        out[SECTION_COLLECTION[key]] = (data[key] as ResumeData[ResumeListKey][number][]).filter(it => it.isSelected).map(it => it.id);
    }
    return out;
}

/** Normalises whatever is stored on a variant doc into a full VariantItems map. */
export function readVariantItems(raw: Record<string, string[]> | undefined | null): VariantItems {
    const out = emptyVariantItems();
    if (!raw) return out;
    for (const c of COLLECTION_NAMES) out[c] = Array.isArray(raw[c]) ? raw[c].filter(x => typeof x === "string") : [];
    return out;
}

/** The document with `isSelected` set from the variant's pointers (pure preview of a load). */
export function applyVariant(data: ResumeData, items: VariantItems): ResumeData {
    const next: ResumeData = { ...data };
    for (const key of RESUME_LIST_KEYS) {
        const wanted = new Set(items[SECTION_COLLECTION[key]]);
        (next[key] as unknown[]) = (data[key] as ResumeData[ResumeListKey][number][]).map(it => ({ ...it, isSelected: wanted.has(it.id) }));
    }
    return next;
}

export function countItems(items: VariantItems): number {
    return COLLECTION_NAMES.reduce((n, c) => n + items[c].length, 0);
}

/** Pointers to items that no longer exist in the library. */
export function missingCount(items: VariantItems, data: ResumeData): number {
    let missing = 0;
    for (const key of RESUME_LIST_KEYS) {
        const have = new Set((data[key] as { id: string }[]).map(it => it.id));
        missing += items[SECTION_COLLECTION[key]].filter(id => !have.has(id)).length;
    }
    return missing;
}

/** True when the working selection is exactly the variant's (existing) pointers. */
export function selectionEquals(data: ResumeData, items: VariantItems): boolean {
    const current = selectedIds(data);
    for (const key of RESUME_LIST_KEYS) {
        const have = new Set((data[key] as { id: string }[]).map(it => it.id));
        const a = [...current[SECTION_COLLECTION[key]]].sort();
        const b = items[SECTION_COLLECTION[key]].filter(id => have.has(id)).sort();
        if (a.length !== b.length || a.some((x, i) => x !== b[i])) return false;
    }
    return true;
}

/** item id -> names of the variants that reference it. */
export function variantUsage(variants: ResumeVariant[]): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const v of variants) {
        for (const ids of Object.values(v.items)) {
            for (const id of ids) (out[id] ??= []).push(v.name);
        }
    }
    return out;
}
