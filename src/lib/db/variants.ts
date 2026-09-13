// src/lib/db/variants.ts
// Server-only Firestore helpers for users/{uid}/variants.

import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "@/lib/firestore";
import { isoOf, strOf, strArray, userCol } from "@/lib/db/user-collection";
import { COLLECTION_NAMES } from "@/lib/sections";
import { emptyVariantItems, readVariantHidden, readVariantItems, type VariantHidden, type VariantItems } from "@/lib/variants";
import { bulletEntries, bulletLines, pruneHidden, skillEntries } from "@/lib/sub-items";
import type { ResumeVariant } from "@/types/db";
import { DEFAULT_TEMPLATE } from "@/lib/typst/templates";

const BATCH_LIMIT = 450;

export async function readVariants(uid: string): Promise<ResumeVariant[]> {
    const snap = await userCol(uid, "variants").orderBy("updatedAt", "desc").get();
    return snap.docs.map(doc => {
        const d = doc.data();
        return {
            id: doc.id,
            name: strOf(d.name),
            labels: strArray(d.labels),
            items: readVariantItems(d.items as Record<string, string[]> | undefined),
            hidden: readVariantHidden(d.hidden),
            templateId: strOf(d.templateId) || DEFAULT_TEMPLATE,
            createdAt: isoOf(d.createdAt),
            updatedAt: isoOf(d.updatedAt),
        };
    });
}

export async function readVariant(uid: string, id: string): Promise<ResumeVariant | null> {
    const all = await readVariants(uid);
    return all.find(v => v.id === id) ?? null;
}

/** Ids of every existing item per collection (ids only, cheap). */
export async function listItemIds(uid: string): Promise<VariantItems> {
    const out = emptyVariantItems();
    await Promise.all(COLLECTION_NAMES.map(async c => {
        const snap = await userCol(uid, c).select("isSelected").get();
        out[c] = snap.docs.map(d => d.id);
    }));
    return out;
}

/** Collections whose items carry per-bullet / per-skill `hidden` keys. */
const SUB_ITEM_COLLECTIONS = new Set(["experience", "projects", "volunteering", "skills"]);

/** Ids of the currently selected items per collection (the working selection) + their hidden sub-items. */
export async function snapshotSelection(uid: string): Promise<{ items: VariantItems; hidden: VariantHidden }> {
    const items = emptyVariantItems();
    const hidden: VariantHidden = {};
    await Promise.all(COLLECTION_NAMES.map(async c => {
        const withSub = SUB_ITEM_COLLECTIONS.has(c);
        const query = userCol(uid, c).where("isSelected", "==", true);
        const snap = await (withSub ? query.select("hidden", c === "skills" ? "items" : "description") : query.select()).get();
        items[c] = snap.docs.map(d => d.id);
        if (!withSub) return;
        for (const doc of snap.docs) {
            const d = doc.data();
            const entries = c === "skills" ? skillEntries(strOf(d.items)) : bulletEntries(bulletLines(strArray(d.description)));
            const keys = pruneHidden(strArray(d.hidden), entries).sort();
            if (keys.length > 0) hidden[doc.id] = keys;
        }
    }));
    return { items, hidden };
}

/**
 * Makes the working selection equal to `items`: every existing item becomes
 * selected iff referenced, and selected items take the variant's hidden sub-items. Returns the pointers that no longer exist.
 */
export async function applyVariantSelection(uid: string, items: VariantItems, hidden: VariantHidden | null): Promise<{ applied: VariantItems; missing: number }> {
    const existing = await listItemIds(uid);
    const applied = emptyVariantItems();
    let missing = 0;
    const writes: Array<() => void> = [];
    let batch = db.batch();
    const now = Timestamp.now();

    for (const c of COLLECTION_NAMES) {
        const wanted = new Set(items[c]);
        missing += items[c].filter(id => !existing[c].includes(id)).length;
        applied[c] = existing[c].filter(id => wanted.has(id));
        for (const id of existing[c]) {
            const ref = userCol(uid, c).doc(id);
            const isSelected = wanted.has(id);
            // Legacy variants (hidden === null) leave per-bullet selection alone; unselected items keep theirs.
            const patch = hidden !== null && isSelected && SUB_ITEM_COLLECTIONS.has(c)
                ? { isSelected, hidden: hidden[id] ?? [], updatedAt: now }
                : { isSelected, updatedAt: now };
            writes.push(() => batch.update(ref, patch));
        }
    }
    for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
        batch = db.batch();
        for (const w of writes.slice(i, i + BATCH_LIMIT)) w();
        await batch.commit();
    }
    return { applied, missing };
}
