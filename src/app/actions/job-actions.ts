"use server"

import { revalidatePath } from "next/cache"
import { currentUid, requireUid } from "@/lib/db/session";
import { deleteJobDoc, isProposalStatus, patchJob, readJob, readJobs, readPreferences, sanitizeMuteRule, setJobScore, writePreferences } from "@/lib/db/jobs";
import { sameRule } from "@/lib/match/proposals";
import { clampStr } from "@/lib/validation/limits";
import type { Caps, JobRecord, MuteRule, Preferences, ProposalStatus } from "@/lib/match/types";

export async function getJobs(): Promise<JobRecord[]> {
    const uid = await currentUid();
    if (!uid) return [];
    return readJobs(uid);
}

export async function getPreferences(): Promise<Preferences | null> {
    const uid = await currentUid();
    if (!uid) return null;
    return readPreferences(uid);
}

export async function deleteJob(id: string) {
    const uid = await requireUid();
    await deleteJobDoc(uid, id);
    revalidatePath("/dashboard");
}

export async function renameJob(id: string, title: string) {
    const uid = await requireUid();
    await patchJob(uid, id, { title: clampStr(title, 120) || "Untitled job" });
    revalidatePath("/dashboard");
}

export async function setProposalStatus(jobId: string, proposalId: string, status: ProposalStatus) {
    const uid = await requireUid();
    if (!isProposalStatus(status) || typeof proposalId !== "string" || proposalId.length > 64) throw new Error("Invalid proposal update");
    const job = await readJob(uid, jobId);
    if (!job) throw new Error("Job not found");
    const proposals = job.proposals.map(p => (p.id === proposalId ? { ...p, status } : p));
    await patchJob(uid, jobId, { proposals });
    revalidatePath("/dashboard");
}

export async function saveJobScore(jobId: string, score: number) {
    const uid = await requireUid();
    if (typeof score !== "number" || !Number.isFinite(score)) return;
    // No revalidation: the list shows the new number on the next natural refresh.
    await setJobScore(uid, jobId, Math.max(0, Math.min(100, Math.round(score))));
}

export async function muteProposal(input: MuteRule) {
    const uid = await requireUid();
    const rule = sanitizeMuteRule(input);
    if (!rule) throw new Error("Invalid rule");
    const prefs = await readPreferences(uid);
    if (!prefs.mutedProposals.some(r => sameRule(r, rule))) {
        await writePreferences(uid, { mutedProposals: [...prefs.mutedProposals, rule] });
    }
    revalidatePath("/dashboard");
}

export async function unmuteProposal(input: MuteRule) {
    const uid = await requireUid();
    const rule = sanitizeMuteRule(input);
    if (!rule) return;
    const prefs = await readPreferences(uid);
    await writePreferences(uid, { mutedProposals: prefs.mutedProposals.filter(r => !sameRule(r, rule)) });
    revalidatePath("/dashboard");
}

export async function saveCaps(caps: Caps) {
    const uid = await requireUid();
    await writePreferences(uid, { caps });
    revalidatePath("/dashboard");
}
