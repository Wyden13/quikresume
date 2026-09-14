// src/lib/db/meta.ts
// Per-user metadata documents under users/{uid}/meta/*:
//   tags         { aliases: Record<alias, canonical> }   model-reported tag aliases
//   preferences  { mutedProposals, caps }                 Job Match preferences

import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "@/lib/firestore";
import type { AliasMap } from "@/lib/tags/normalize";

const metaDoc = (uid: string, name: string) => db.collection("users").doc(uid).collection("meta").doc(name);

export async function readTagAliases(uid: string): Promise<AliasMap> {
    const snap = await metaDoc(uid, "tags").get();
    const raw = snap.data()?.aliases;
    const out: AliasMap = {};
    if (raw && typeof raw === "object") {
        for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === "string") out[k] = v;
    }
    return out;
}

export async function mergeTagAliases(uid: string, aliases: AliasMap): Promise<void> {
    if (Object.keys(aliases).length === 0) return;
    await metaDoc(uid, "tags").set({ aliases, updatedAt: Timestamp.now() }, { merge: true });
}

export async function readMeta(uid: string, name: string): Promise<Record<string, unknown>> {
    const snap = await metaDoc(uid, name).get();
    return (snap.data() as Record<string, unknown> | undefined) ?? {};
}

/** Replaces the whole document (nested maps are not merged, so removed keys disappear). */
export async function replaceMeta(uid: string, name: string, doc: Record<string, unknown>): Promise<void> {
    await metaDoc(uid, name).set({ ...doc, updatedAt: Timestamp.now() });
}

export async function writeMeta(uid: string, name: string, patch: Record<string, unknown>): Promise<void> {
    await metaDoc(uid, name).set({ ...patch, updatedAt: Timestamp.now() }, { merge: true });
}
