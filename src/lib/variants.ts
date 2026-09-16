// src/lib/variants.ts
// Pure helpers for resume variants (saved selections). A variant stores item
// ids per Firestore collection; the dashboard's `isSelected` flags remain the
// working selection that a variant is snapshotted from / loaded into.

import type { ResumeData, ResumeListKey } from "@/types/schema";
import { RESUME_LIST_KEYS } from "@/types/schema";
import type { ResumeVariant } from "@/types/db";
import { COLLECTION_NAMES, SECTION_COLLECTION, type CollectionName } from "@/lib/sections";
import { toBullets } from "@/lib/typst/doc";
import { bulletEntries, pruneHidden, skillEntries, SUB_ITEM_SECTIONS, type SubItem, type SubItemSection } from "@/lib/sub-items";

export type VariantItems = Record<CollectionName, string[]>;

/**
 * item id -> hidden bullet / skill keys, for the selected items of the sections
 * that support it. `null` on variants saved before per-bullet selection existed:
 * loading those leaves `hidden` untouched.
 */
export type VariantHidden = Record<string, string[]>;

type SubItemCarrier = ResumeData[SubItemSection][number];

/** The bullets / skills an item currently has (what `hidden` keys refer to). */
export function subItemEntries(section: SubItemSection, item: SubItemCarrier): SubItem[] {
    return section === "skills"
        ? skillEntries((item as ResumeData["skills"][number]).items)
        : bulletEntries(toBullets((item as ResumeData["workExperience"][number]).description));
}

/** Hidden keys (pruned, sorted) of every selected item that has any. */
export function selectedHidden(data: ResumeData): VariantHidden {
    const out: VariantHidden = {};
    for (const section of SUB_ITEM_SECTIONS) {
        for (const item of data[section] as SubItemCarrier[]) {
            if (!item.isSelected) continue;
            const keys = pruneHidden(item.hidden, subItemEntries(section, item)).sort();
            if (keys.length > 0) out[item.id] = keys;
        }
    }
    return out;
}

/** Bounds for pointer maps coming from a request body (a variant is at most a few hundred ids). */
const MAX_IDS_PER_COLLECTION = 500;
const MAX_HIDDEN_ITEMS = 1000;
const MAX_HIDDEN_KEYS = 300;
const MAX_KEY_LEN = 12_000;
const isId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(v);

export function readVariantHidden(raw: unknown): VariantHidden | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const out: VariantHidden = {};
    for (const [id, keys] of Object.entries(raw as Record<string, unknown>).slice(0, MAX_HIDDEN_ITEMS)) {
        if (!isId(id) || !Array.isArray(keys)) continue;
        out[id] = keys.filter((k): k is string => typeof k === "string" && k.length <= MAX_KEY_LEN).slice(0, MAX_HIDDEN_KEYS);
    }
    return out;
}

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
    for (const c of COLLECTION_NAMES) out[c] = Array.isArray(raw[c]) ? [...new Set(raw[c].filter(isId))].slice(0, MAX_IDS_PER_COLLECTION) : [];
    return out;
}

/** The document with `isSelected` set from the variant's pointers (pure preview of a load). */
export function applyVariant(data: ResumeData, items: VariantItems, hidden: VariantHidden | null = null): ResumeData {
    const next: ResumeData = { ...data };
    const subSections: readonly ResumeListKey[] = SUB_ITEM_SECTIONS;
    for (const key of RESUME_LIST_KEYS) {
        const wanted = new Set(items[SECTION_COLLECTION[key]]);
        const withHidden = hidden !== null && subSections.includes(key);
        (next[key] as unknown[]) = (data[key] as ResumeData[ResumeListKey][number][]).map(it => {
            const isSelected = wanted.has(it.id);
            return withHidden && isSelected ? { ...it, isSelected, hidden: hidden[it.id] ?? [] } : { ...it, isSelected };
        });
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
export function selectionEquals(data: ResumeData, items: VariantItems, hidden: VariantHidden | null = null): boolean {
    const current = selectedIds(data);
    for (const key of RESUME_LIST_KEYS) {
        const have = new Set((data[key] as { id: string }[]).map(it => it.id));
        const a = [...current[SECTION_COLLECTION[key]]].sort();
        const b = items[SECTION_COLLECTION[key]].filter(id => have.has(id)).sort();
        if (a.length !== b.length || a.some((x, i) => x !== b[i])) return false;
    }
    if (hidden === null) return true;
    // Compare against the variant's keys pruned to the items' current text.
    const currentHidden = selectedHidden(data);
    for (const section of SUB_ITEM_SECTIONS) {
        for (const item of data[section] as SubItemCarrier[]) {
            if (!item.isSelected) continue;
            const want = pruneHidden(hidden[item.id], subItemEntries(section, item)).sort();
            const have = currentHidden[item.id] ?? [];
            if (want.length !== have.length || want.some((k, i) => k !== have[i])) return false;
        }
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
