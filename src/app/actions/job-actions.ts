"use server"

import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { deleteJobDoc, patchJob, readJob, readJobs, readPreferences, setJobScore, writePreferences } from "@/lib/db/jobs";
import { sameRule } from "@/lib/match/proposals";
import type { Caps, JobRecord, MuteRule, Preferences, ProposalStatus } from "@/lib/match/types";

async function requireUid(): Promise<string> {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    return session.user.id;
}

export async function getJobs(): Promise<JobRecord[]> {
    const session = await auth();
    if (!session?.user?.id) return [];
    return readJobs(session.user.id);
}

export async function getPreferences(): Promise<Preferences | null> {
    const session = await auth();
    if (!session?.user?.id) return null;
    return readPreferences(session.user.id);
}

export async function deleteJob(id: string) {
    const uid = await requireUid();
    await deleteJobDoc(uid, id);
    revalidatePath("/dashboard");
}

export async function renameJob(id: string, title: string) {
    const uid = await requireUid();
    await patchJob(uid, id, { title: title.trim().slice(0, 120) || "Untitled job" });
    revalidatePath("/dashboard");
}

export async function setProposalStatus(jobId: string, proposalId: string, status: ProposalStatus) {
    const uid = await requireUid();
    const job = await readJob(uid, jobId);
    if (!job) throw new Error("Job not found");
    const proposals = job.proposals.map(p => (p.id === proposalId ? { ...p, status } : p));
    await patchJob(uid, jobId, { proposals });
    revalidatePath("/dashboard");
}

export async function saveJobScore(jobId: string, score: number) {
    const uid = await requireUid();
    // No revalidation: the list shows the new number on the next natural refresh.
    await setJobScore(uid, jobId, Math.max(0, Math.min(100, Math.round(score))));
}

export async function muteProposal(rule: MuteRule) {
    const uid = await requireUid();
    const prefs = await readPreferences(uid);
    if (!prefs.mutedProposals.some(r => sameRule(r, rule))) {
        await writePreferences(uid, { mutedProposals: [...prefs.mutedProposals, rule] });
    }
    revalidatePath("/dashboard");
}

export async function unmuteProposal(rule: MuteRule) {
    const uid = await requireUid();
    const prefs = await readPreferences(uid);
    await writePreferences(uid, { mutedProposals: prefs.mutedProposals.filter(r => !sameRule(r, rule)) });
    revalidatePath("/dashboard");
}

export async function saveCaps(caps: Caps) {
    const uid = await requireUid();
    await writePreferences(uid, { caps });
    revalidatePath("/dashboard");
}
