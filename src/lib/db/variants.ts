// src/lib/db/variants.ts
// Server-only Firestore helpers for users/{uid}/variants.

import "server-only";
import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { db } from "@/lib/firestore";
import { isoOf, strOf, strArray, userCol, userDoc } from "@/lib/db/user-collection";
import { isDocId } from "@/lib/validation/limits";
import { COLLECTION_NAMES } from "@/lib/sections";
import { emptyVariantItems, readVariantHidden, readVariantItems, type VariantHidden, type VariantItems } from "@/lib/variants";
import { bulletEntries, bulletLines, pruneHidden, skillEntries } from "@/lib/sub-items";
import type { ResumeVariant } from "@/types/db";
import { DEFAULT_TEMPLATE } from "@/lib/typst/templates";
import { normalizeLayout } from "@/lib/layout/presets";
import { readMeta } from "@/lib/db/meta";
import type { ResumeLayout } from "@/lib/layout/types";

const BATCH_LIMIT = 450;

function mapVariant(id: string, d: DocumentData): ResumeVariant {
    return {
        id,
        name: strOf(d.name),
        labels: strArray(d.labels),
        items: readVariantItems(d.items as Record<string, string[]> | undefined),
        hidden: readVariantHidden(d.hidden),
        layout: d.layout ? normalizeLayout(d.layout) : null,
        templateId: strOf(d.templateId) || DEFAULT_TEMPLATE,
        createdAt: isoOf(d.createdAt),
        updatedAt: isoOf(d.updatedAt),
    };
}

export async function readVariants(uid: string): Promise<ResumeVariant[]> {
    const snap = await userCol(uid, "variants").orderBy("updatedAt", "desc").get();
    return snap.docs.map(doc => mapVariant(doc.id, doc.data()));
}

/** One variant by id (a single document read, not the whole list). */
export async function readVariant(uid: string, id: string): Promise<ResumeVariant | null> {
    if (!isDocId(id)) return null;
    const doc = await userDoc(uid, "variants", id).get();
    const d = doc.data();
    return doc.exists && d ? mapVariant(doc.id, d) : null;
}

/** The working layout, for variant snapshots. */
export async function readWorkingLayout(uid: string): Promise<ResumeLayout> {
    return normalizeLayout(await readMeta(uid, "layout"));
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

const sameKeys = (a: string[], b: string[]) => a.length === b.length && [...a].sort().every((k, i) => k === [...b].sort()[i]);

/**
 * Makes the working selection equal to `items`: every existing item becomes
 * selected iff referenced, and selected items take the variant's hidden sub-items. Returns the pointers that no longer exist.
 * Reads `isSelected` + `hidden` first and writes only the documents that actually change (loading a
 * variant that differs in three items costs three writes, not the whole library).
 */
export async function applyVariantSelection(uid: string, items: VariantItems, hidden: VariantHidden | null): Promise<{ applied: VariantItems; missing: number }> {
    const applied = emptyVariantItems();
    let missing = 0;
    const writes: Array<(batch: WriteBatchLike) => void> = [];
    const now = Timestamp.now();

    await Promise.all(COLLECTION_NAMES.map(async c => {
        const snap = await userCol(uid, c).select("isSelected", "hidden").get();
        const existing = new Set(snap.docs.map(d => d.id));
        const wanted = new Set(items[c]);
        missing += items[c].filter(id => !existing.has(id)).length;
        applied[c] = items[c].filter(id => existing.has(id));
        for (const doc of snap.docs) {
            const isSelected = wanted.has(doc.id);
            const current = doc.get("isSelected") === true;
            // Legacy variants (hidden === null) leave per-bullet selection alone; unselected items keep theirs.
            const setHidden = hidden !== null && isSelected && SUB_ITEM_COLLECTIONS.has(c);
            const nextHidden = setHidden ? hidden[doc.id] ?? [] : null;
            const hiddenChanged = setHidden && !sameKeys(strArray(doc.get("hidden")), nextHidden as string[]);
            if (current === isSelected && !hiddenChanged) continue;
            const patch = setHidden ? { isSelected, hidden: nextHidden, updatedAt: now } : { isSelected, updatedAt: now };
            const ref = doc.ref;
            writes.push(batch => batch.update(ref, patch));
        }
    }));
    for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        for (const w of writes.slice(i, i + BATCH_LIMIT)) w(batch);
        await batch.commit();
    }
    return { applied, missing };
}

type WriteBatchLike = ReturnType<typeof db.batch>;
