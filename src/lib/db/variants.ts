// src/lib/db/variants.ts
// Server-only Firestore helpers for users/{uid}/variants.

import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "@/lib/firestore";
import { isoOf, strOf, strArray, userCol } from "@/lib/db/user-collection";
import { COLLECTION_NAMES } from "@/lib/sections";
import { emptyVariantItems, readVariantItems, type VariantItems } from "@/lib/variants";
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

/** Ids of the currently selected items per collection (the working selection). */
export async function snapshotSelection(uid: string): Promise<VariantItems> {
    const out = emptyVariantItems();
    await Promise.all(COLLECTION_NAMES.map(async c => {
        const snap = await userCol(uid, c).where("isSelected", "==", true).select().get();
        out[c] = snap.docs.map(d => d.id);
    }));
    return out;
}

/**
 * Makes the working selection equal to `items`: every existing item becomes
 * selected iff referenced. Returns the pointers that no longer exist.
 */
export async function applyVariantSelection(uid: string, items: VariantItems): Promise<{ applied: VariantItems; missing: number }> {
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
            writes.push(() => batch.update(ref, { isSelected: wanted.has(id), updatedAt: now }));
        }
    }
    for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
        batch = db.batch();
        for (const w of writes.slice(i, i + BATCH_LIMIT)) w();
        await batch.commit();
    }
    return { applied, missing };
}
