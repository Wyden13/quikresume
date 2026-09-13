// src/lib/tags/aggregate.ts
// Pure aggregation of item tags into weights. Weight = number of (selected)
// items carrying the tag; the profile counts as one item. Runs on the client
// for live views and on the server for scoring.

import type { ResumeData, ResumeListKey } from "@/types/schema";
import { RESUME_LIST_KEYS } from "@/types/schema";
import { TAG_KINDS, type Tag, type TagKind } from "@/lib/tags/types";
import { itemTitle } from "@/lib/sections";
import type { TagSection } from "@/lib/tags/content";

export interface TagCarrier {
    section: TagSection;
    id: string;
    label: string;
}

export interface TagWeight extends Tag {
    weight: number;
    items: TagCarrier[];
}

export type KindTotals = Record<TagKind, number>;

export function emptyKindTotals(): KindTotals {
    return Object.fromEntries(TAG_KINDS.map(k => [k.id, 0])) as KindTotals;
}

/** All tag carriers in the document, optionally restricted to selected items. */
export function tagCarriers(data: ResumeData, selectedOnly: boolean): Array<{ carrier: TagCarrier; tags: Tag[] }> {
    const out: Array<{ carrier: TagCarrier; tags: Tag[] }> = [];
    if (data.profileTags.length > 0) {
        out.push({ carrier: { section: "profile", id: "profile", label: "Headline & summary" }, tags: data.profileTags });
    }
    for (const key of RESUME_LIST_KEYS) {
        for (const item of data[key] as ResumeData[ResumeListKey][number][]) {
            if (selectedOnly && !item.isSelected) continue;
            if (item.tags.length === 0) continue;
            out.push({ carrier: { section: key, id: item.id, label: itemTitle(key, item) }, tags: item.tags });
        }
    }
    return out;
}

/** Sorted by weight desc, then name. */
export function aggregateTags(data: ResumeData, opts: { selectedOnly: boolean }): TagWeight[] {
    const map = new Map<string, TagWeight>();
    for (const { carrier, tags } of tagCarriers(data, opts.selectedOnly)) {
        const seen = new Set<string>();
        for (const tag of tags) {
            if (seen.has(tag.name)) continue;
            seen.add(tag.name);
            const w = map.get(tag.name);
            if (w) {
                w.weight += 1;
                w.items.push(carrier);
            } else {
                map.set(tag.name, { ...tag, weight: 1, items: [carrier] });
            }
        }
    }
    return [...map.values()].sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name));
}

export function kindTotals(weights: Pick<TagWeight, "kind" | "weight">[]): KindTotals {
    const totals = emptyKindTotals();
    for (const w of weights) totals[w.kind] += w.weight;
    return totals;
}

export function tagVector(weights: TagWeight[]): Map<string, TagWeight> {
    return new Map(weights.map(w => [w.name, w]));
}
