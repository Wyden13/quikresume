// src/lib/db/jobs.ts
// Server-only Firestore helpers for users/{uid}/jobs and Job Match preferences.

import "server-only";
import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { isoOf, strArray, strOf, userCol } from "@/lib/db/user-collection";
import { readMeta, writeMeta } from "@/lib/db/meta";
import { isTagKind } from "@/lib/tags/types";
import { RESUME_LIST_KEYS, type ResumeListKey } from "@/types/schema";
import {
    DEFAULT_CAPS, type Caps, type JobRecord, type MuteRule, type Preferences, type Proposal, type ProposalKind,
    type ProposalStatus, type Requirement,
} from "@/lib/match/types";

const KINDS = new Set<string>(["include", "exclude", "rewrite-bullet", "add-skill", "gap"]);
const STATUSES = new Set<string>(["open", "applied", "skipped", "ignored"]);

export function readRequirements(v: unknown): Requirement[] {
    if (!Array.isArray(v)) return [];
    const out: Requirement[] = [];
    for (const r of v) {
        if (!r || typeof r !== "object") continue;
        const o = r as Record<string, unknown>;
        if (typeof o.name !== "string" || !o.name || !isTagKind(o.kind)) continue;
        out.push({
            name: o.name,
            display: typeof o.display === "string" && o.display ? o.display : o.name,
            kind: o.kind,
            importance: o.importance === "nice" ? "nice" : "must",
            yearsMin: typeof o.yearsMin === "number" ? o.yearsMin : null,
            satisfiedBy: strArray(o.satisfiedBy),
            evidence: strArray(o.evidence),
            reason: strOf(o.reason),
        });
    }
    return out;
}

export function readProposals(v: unknown): Proposal[] {
    if (!Array.isArray(v)) return [];
    const out: Proposal[] = [];
    for (const r of v) {
        if (!r || typeof r !== "object") continue;
        const o = r as Record<string, unknown>;
        if (typeof o.id !== "string" || typeof o.kind !== "string" || !KINDS.has(o.kind)) continue;
        out.push({
            id: o.id,
            kind: o.kind as ProposalKind,
            section: typeof o.section === "string" && (RESUME_LIST_KEYS as string[]).includes(o.section) ? (o.section as ResumeListKey) : undefined,
            itemId: typeof o.itemId === "string" ? o.itemId : undefined,
            itemLabel: typeof o.itemLabel === "string" ? o.itemLabel : undefined,
            tags: strArray(o.tags),
            current: typeof o.current === "string" ? o.current : undefined,
            proposed: typeof o.proposed === "string" ? o.proposed : undefined,
            reason: strOf(o.reason),
            status: typeof o.status === "string" && STATUSES.has(o.status) ? (o.status as ProposalStatus) : "open",
        });
    }
    return out;
}

function mapJob(id: string, d: DocumentData): JobRecord {
    const src = (d.source ?? {}) as Record<string, unknown>;
    return {
        id,
        title: strOf(d.title),
        company: strOf(d.company),
        source: { kind: src.kind === "file" ? "file" : "paste", fileName: typeof src.fileName === "string" ? src.fileName : null },
        jdText: strOf(d.jdText),
        summary: strOf(d.summary),
        requirements: readRequirements(d.requirements),
        proposals: readProposals(d.proposals),
        proposalsAt: isoOf(d.proposalsAt),
        lastScore: typeof d.lastScore === "number" ? d.lastScore : null,
        createdAt: isoOf(d.createdAt),
        updatedAt: isoOf(d.updatedAt),
    };
}

export async function readJobs(uid: string): Promise<JobRecord[]> {
    const snap = await userCol(uid, "jobs").orderBy("updatedAt", "desc").get();
    return snap.docs.map(doc => mapJob(doc.id, doc.data()));
}

export async function readJob(uid: string, id: string): Promise<JobRecord | null> {
    const doc = await userCol(uid, "jobs").doc(id).get();
    const d = doc.data();
    return doc.exists && d ? mapJob(doc.id, d) : null;
}

export async function createJob(uid: string, job: Omit<JobRecord, "id" | "createdAt" | "updatedAt" | "proposals" | "proposalsAt" | "lastScore">): Promise<JobRecord> {
    const now = Timestamp.now();
    const ref = await userCol(uid, "jobs").add({ ...job, proposals: [], proposalsAt: null, lastScore: null, createdAt: now, updatedAt: now });
    return { ...job, id: ref.id, proposals: [], proposalsAt: null, lastScore: null, createdAt: now.toDate().toISOString(), updatedAt: now.toDate().toISOString() };
}

export async function patchJob(uid: string, id: string, patch: Record<string, unknown>): Promise<void> {
    await userCol(uid, "jobs").doc(id).update({ ...patch, updatedAt: Timestamp.now() });
}

export async function deleteJobDoc(uid: string, id: string): Promise<void> {
    await userCol(uid, "jobs").doc(id).delete();
}

// ---------- preferences (users/{uid}/meta/preferences)

function readMuteRules(v: unknown): MuteRule[] {
    if (!Array.isArray(v)) return [];
    const out: MuteRule[] = [];
    for (const r of v) {
        if (!r || typeof r !== "object") continue;
        const o = r as Record<string, unknown>;
        if (typeof o.kind !== "string" || !KINDS.has(o.kind)) continue;
        out.push({ kind: o.kind as ProposalKind, tag: typeof o.tag === "string" ? o.tag : undefined, itemId: typeof o.itemId === "string" ? o.itemId : undefined });
    }
    return out;
}

function readCaps(v: unknown): Caps {
    const caps: Caps = { ...DEFAULT_CAPS };
    if (v && typeof v === "object") {
        for (const key of RESUME_LIST_KEYS) {
            const x = (v as Record<string, unknown>)[key];
            if (x === null) caps[key] = null;
            else if (typeof x === "number" && Number.isFinite(x) && x >= 0) caps[key] = Math.floor(x);
        }
    }
    return caps;
}

export async function readPreferences(uid: string): Promise<Preferences> {
    const d = await readMeta(uid, "preferences");
    return { mutedProposals: readMuteRules(d.mutedProposals), caps: readCaps(d.caps) };
}

export async function writePreferences(uid: string, patch: Partial<Preferences>): Promise<void> {
    const data: Record<string, unknown> = {};
    if (patch.mutedProposals) data.mutedProposals = patch.mutedProposals.map(r => ({ kind: r.kind, tag: r.tag ?? null, itemId: r.itemId ?? null }));
    if (patch.caps) data.caps = patch.caps;
    await writeMeta(uid, "preferences", data);
}
