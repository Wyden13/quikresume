// src/lib/db/user-collection.ts
// Shared Firestore helpers for the per-user subcollections. This is a plain
// server-only module (NOT "use server"): the *-actions.ts files stay thin
// async wrappers around these so each action can still check the session.

import "server-only";
import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { db } from "@/lib/firestore";
import { toUtcDate } from "@/lib/dates";

export type OrderSpec = { field: string; dir: "asc" | "desc" } | null;

export const userCol = (uid: string, name: string) => db.collection("users").doc(uid).collection(name);

/** "YYYY-MM-DD" -> Timestamp at UTC midnight, or null. */
export const toTimestamp = (s: string | null | undefined): Timestamp | null => {
    const d = toUtcDate(s);
    return d ? Timestamp.fromDate(d) : null;
};

/** Firestore Timestamp -> ISO string; anything else -> null. */
export const isoOf = (v: unknown): string | null =>
    v && typeof (v as Timestamp).toDate === "function" ? (v as Timestamp).toDate().toISOString() : null;

export const strOrNull = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

export const strOf = (v: unknown): string => (typeof v === "string" ? v : "");

export const strArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** Checkbox-style booleans arrive as "on" (native) or "true" (hidden input). */
export const formBool = (fd: FormData, key: string): boolean => {
    const v = fd.get(key);
    return v === "on" || v === "true";
};

/** Optional string field from FormData: "" -> null. */
export const formStrOrNull = (fd: FormData, key: string): string | null => (fd.get(key) as string) || null;

export async function readCol<T>(
    uid: string,
    name: string,
    order: OrderSpec,
    mapRow: (id: string, data: DocumentData) => T,
): Promise<T[]> {
    const col = userCol(uid, name);
    // NOTE: orderBy(field) silently drops documents missing that field; every
    // writer must always set the ordered field (null is fine, absent is not).
    const snapshot = await (order ? col.orderBy(order.field, order.dir) : col).get();
    return snapshot.docs.map(doc => mapRow(doc.id, doc.data()));
}

export async function updateUserDoc(uid: string, name: string, id: string, patch: Record<string, unknown>) {
    await userCol(uid, name).doc(id).update({ ...patch, updatedAt: Timestamp.now() });
}

export async function deleteUserDoc(uid: string, name: string, id: string) {
    await userCol(uid, name).doc(id).delete();
}
