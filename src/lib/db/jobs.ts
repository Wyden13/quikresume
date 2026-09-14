// src/lib/db/jobs.ts
// Server-only Firestore helpers for users/{uid}/jobs and Job Match preferences.

import "server-only";
import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { isoOf, strArray, strOf, userCol } from "@/lib/db/user-collection";
import { readMeta, writeMeta } from "@/lib/db/meta";
import { isTagKind } from "@/lib/tags/types";
import { RESUME_LIST_KEYS, type ResumeListKey } from "@/types/schema";
import {
    DEFAULT_CAPS, IDLE_MATCH, type Caps, type DeclinedSkill, type JobMatchState, type JobRecord, type MuteRule, type Preferences, type Proposal, type ProposalKind,
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

export const MATCH_STALLED_WARNING = "The AI match check did not finish.";

function readMatch(v: unknown): JobMatchState {
    if (!v || typeof v !== "object") return IDLE_MATCH;
    const o = v as Record<string, unknown>;
    const status = o.status === "running" || o.status === "done" || o.status === "failed" ? o.status : "idle";
    const runningUntil = isoOf(o.runningUntil);
    const match: JobMatchState = {
        status,
        runningUntil,
        checkedAt: isoOf(o.checkedAt),
        libraryHash: typeof o.libraryHash === "string" ? o.libraryHash : null,
        warning: strOf(o.warning),
    };
    // A function that died mid-run (platform timeout, crash) never writes "failed" itself.
    if (status === "running" && (!runningUntil || Date.parse(runningUntil) < Date.now())) {
        return { ...match, status: "failed", warning: match.warning || MATCH_STALLED_WARNING };
    }
    return match;
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
        fitNotes: strArray(d.fitNotes),
        match: readMatch(d.match),
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

/** Firestore shape of a match state (timestamps, not ISO strings). */
function matchDoc(m: { status: JobMatchState["status"]; runningUntilMs?: number | null; checkedAt?: Timestamp | null; libraryHash?: string | null; warning?: string }) {
    return {
        status: m.status,
        runningUntil: m.runningUntilMs ? Timestamp.fromMillis(m.runningUntilMs) : null,
        checkedAt: m.checkedAt ?? null,
        libraryHash: m.libraryHash ?? null,
        warning: m.warning ?? "",
    };
}

/** `runningForMs` set = a background reconcile starts right after (status "running"). */
export async function createJob(
    uid: string,
    job: Omit<JobRecord, "id" | "createdAt" | "updatedAt" | "proposals" | "proposalsAt" | "lastScore" | "match">,
    opts: { runningForMs?: number } = {},
): Promise<JobRecord> {
    const now = Timestamp.now();
    const runningUntilMs = opts.runningForMs ? now.toMillis() + opts.runningForMs : null;
    const match = matchDoc({ status: runningUntilMs ? "running" : "idle", runningUntilMs });
    const ref = await userCol(uid, "jobs").add({ ...job, match, proposals: [], proposalsAt: null, lastScore: null, createdAt: now, updatedAt: now });
    return {
        ...job,
        id: ref.id,
        match: { ...IDLE_MATCH, status: match.status, runningUntil: runningUntilMs ? new Date(runningUntilMs).toISOString() : null },
        proposals: [],
        proposalsAt: null,
        lastScore: null,
        createdAt: now.toDate().toISOString(),
        updatedAt: now.toDate().toISOString(),
    };
}

/** Marks a background reconcile as running. No `updatedAt`, so the job list keeps its order until the result lands. */
export async function markJobMatchRunning(uid: string, id: string, runningForMs: number, prev: JobMatchState): Promise<JobMatchState> {
    const runningUntilMs = Date.now() + runningForMs;
    await userCol(uid, "jobs").doc(id).update({
        match: matchDoc({ status: "running", runningUntilMs, checkedAt: prev.checkedAt ? Timestamp.fromDate(new Date(prev.checkedAt)) : null, libraryHash: prev.libraryHash }),
    });
    return { ...prev, status: "running", runningUntil: new Date(runningUntilMs).toISOString(), warning: "" };
}

/** Final state of a reconcile run; `requirements` only when it produced verdicts. */
export async function finishJobMatch(
    uid: string,
    id: string,
    result: { requirements?: Requirement[]; libraryHash: string | null; warning?: string },
): Promise<void> {
    const ok = !result.warning;
    const match = matchDoc({ status: ok ? "done" : "failed", checkedAt: Timestamp.now(), libraryHash: ok ? result.libraryHash : null, warning: result.warning });
    if (result.requirements) await patchJob(uid, id, { requirements: result.requirements, match });
    else await userCol(uid, "jobs").doc(id).update({ match });
}

/**
 * Firestore rejects `undefined` anywhere in a document ("Cannot use undefined as a
 * Firestore value"), and proposals/requirements carry optional fields. Drop them.
 */
export function stripUndefined<T>(value: T): T {
    if (Array.isArray(value)) return value.map(stripUndefined) as T;
    if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined).map(([k, v]) => [k, stripUndefined(v)]),
        ) as T;
    }
    return value;
}

export async function patchJob(uid: string, id: string, patch: Record<string, unknown>): Promise<void> {
    await userCol(uid, "jobs").doc(id).update({ ...stripUndefined(patch), updatedAt: Timestamp.now() });
}

/** Writes only `lastScore`: no `updatedAt`, so recording a score never reorders the job list. */
export async function setJobScore(uid: string, id: string, lastScore: number): Promise<void> {
    await userCol(uid, "jobs").doc(id).update({ lastScore });
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

function readDeclined(v: unknown): DeclinedSkill[] {
    if (!Array.isArray(v)) return [];
    const out: DeclinedSkill[] = [];
    for (const r of v) {
        if (!r || typeof r !== "object") continue;
        const o = r as Record<string, unknown>;
        if (typeof o.name !== "string" || !o.name) continue;
        out.push({ name: o.name, display: strOf(o.display) || o.name, at: typeof o.at === "string" ? o.at : null });
    }
    return out;
}

export async function readPreferences(uid: string): Promise<Preferences> {
    const d = await readMeta(uid, "preferences");
    return { mutedProposals: readMuteRules(d.mutedProposals), caps: readCaps(d.caps), declinedSoftSkills: readDeclined(d.declinedSoftSkills) };
}

export async function writePreferences(uid: string, patch: Partial<Preferences>): Promise<void> {
    const data: Record<string, unknown> = {};
    if (patch.mutedProposals) data.mutedProposals = patch.mutedProposals.map(r => ({ kind: r.kind, tag: r.tag ?? null, itemId: r.itemId ?? null }));
    if (patch.caps) data.caps = patch.caps;
    if (patch.declinedSoftSkills) data.declinedSoftSkills = patch.declinedSoftSkills.map(r => ({ name: r.name, display: r.display, at: r.at ?? null }));
    await writeMeta(uid, "preferences", data);
}
