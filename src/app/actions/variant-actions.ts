"use server"

import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { Timestamp } from "firebase-admin/firestore";
import { db } from "@/lib/firestore";
import { userCol } from "@/lib/db/user-collection";
import { applyVariantSelection, readVariant, readVariants, snapshotSelection } from "@/lib/db/variants";
import { DEFAULT_TEMPLATE } from "@/lib/typst/templates";
import type { ResumeVariant } from "@/types/db";

const MAX_NAME = 80;
const MAX_LABELS = 12;

const cleanName = (s: string) => s.trim().slice(0, MAX_NAME);
const cleanLabels = (labels: string[]) =>
    [...new Set(labels.map(l => l.trim().slice(0, 40)).filter(Boolean))].slice(0, MAX_LABELS);

const revalidate = () => {
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/variants");
};

async function requireUid(): Promise<string> {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    return session.user.id;
}

export async function getVariants(): Promise<ResumeVariant[]> {
    const session = await auth();
    if (!session?.user?.id) return [];
    return readVariants(session.user.id);
}

export async function getLoadedVariantId(): Promise<string | null> {
    const session = await auth();
    if (!session?.user?.id) return null;
    const doc = await db.collection("users").doc(session.user.id).get();
    const v = doc.data()?.loadedVariantId;
    return typeof v === "string" && v ? v : null;
}

/** Snapshots the current working selection as a new variant. */
export async function createVariant(input: { name: string; labels?: string[] }): Promise<{ id: string }> {
    const uid = await requireUid();
    const name = cleanName(input.name) || "Untitled resume";
    const { items, hidden } = await snapshotSelection(uid);
    const now = Timestamp.now();
    const ref = await userCol(uid, "variants").add({
        name, labels: cleanLabels(input.labels ?? []), items, hidden, templateId: DEFAULT_TEMPLATE, createdAt: now, updatedAt: now,
    });
    await db.collection("users").doc(uid).set({ loadedVariantId: ref.id, updatedAt: now }, { merge: true });
    revalidate();
    return { id: ref.id };
}

export async function updateVariant(id: string, patch: { name?: string; labels?: string[] }) {
    const uid = await requireUid();
    const data: Record<string, unknown> = { updatedAt: Timestamp.now() };
    if (patch.name !== undefined) data.name = cleanName(patch.name) || "Untitled resume";
    if (patch.labels !== undefined) data.labels = cleanLabels(patch.labels);
    await userCol(uid, "variants").doc(id).update(data);
    revalidate();
}

/** Replaces the variant's pointers (and hidden sub-items) with the current working selection. */
export async function resnapshotVariant(id: string) {
    const uid = await requireUid();
    const { items, hidden } = await snapshotSelection(uid);
    const now = Timestamp.now();
    await userCol(uid, "variants").doc(id).update({ items, hidden, updatedAt: now });
    await db.collection("users").doc(uid).set({ loadedVariantId: id, updatedAt: now }, { merge: true });
    revalidate();
}

export async function duplicateVariant(id: string): Promise<{ id: string }> {
    const uid = await requireUid();
    const src = await readVariant(uid, id);
    if (!src) throw new Error("Variant not found");
    const now = Timestamp.now();
    const ref = await userCol(uid, "variants").add({
        name: cleanName(`${src.name} (copy)`), labels: src.labels, items: src.items, hidden: src.hidden, templateId: src.templateId, createdAt: now, updatedAt: now,
    });
    revalidate();
    return { id: ref.id };
}

export async function deleteVariant(id: string) {
    const uid = await requireUid();
    await userCol(uid, "variants").doc(id).delete();
    const userRef = db.collection("users").doc(uid);
    const doc = await userRef.get();
    if (doc.data()?.loadedVariantId === id) await userRef.set({ loadedVariantId: null }, { merge: true });
    revalidate();
}

/** Makes the working selection equal to the variant. Returns how many pointers no longer exist. */
export async function loadVariant(id: string): Promise<{ missing: number }> {
    const uid = await requireUid();
    const v = await readVariant(uid, id);
    if (!v) throw new Error("Variant not found");
    const { applied, missing } = await applyVariantSelection(uid, v.items, v.hidden);
    const now = Timestamp.now();
    if (missing > 0) await userCol(uid, "variants").doc(id).update({ items: applied, updatedAt: now });
    await db.collection("users").doc(uid).set({ loadedVariantId: id, updatedAt: now }, { merge: true });
    revalidate();
    return { missing };
}
