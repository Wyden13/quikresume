// src/app/api/jobs/reconcile/route.ts
// POST { jobId, resume: ResumeData } -> { ok, job } with `job.match.status: "running"`.
// Re-runs the "broader context" pass (lib/match/reconcile.ts) for a saved job against the resume
// the user is scoring. The pass runs after the response (after(), max effort) and stores the verdicts
// on the job's requirements; the client polls while the job reads as running.

import { after, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isGlmConfigured } from "@/lib/glm/client";
import { readTagAliases } from "@/lib/db/meta";
import { markJobMatchRunning, readJob } from "@/lib/db/jobs";
import { reconcileRunningMs, reconcileTimeoutMs, runReconcileJob } from "@/lib/match/reconcile";
import { isResumeData } from "@/lib/match/resume-body";
import { readCandidateContext } from "@/lib/db/characterization";

export const runtime = "nodejs";
export const maxDuration = 300;

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

/** GET ?jobId= -> { ok, status }: cheap poll target (one document read) while a background run is in flight. */
export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return fail(401, "You need to be signed in.");
    const jobId = new URL(req.url).searchParams.get("jobId");
    if (!jobId) return fail(400, "Expected `jobId`.");
    const job = await readJob(session.user.id, jobId);
    if (!job) return fail(404, "Job not found.");
    return NextResponse.json({ ok: true, status: job.match.status });
}

export async function POST(req: Request) {
    const startedAt = Date.now();
    const session = await auth();
    if (!session?.user?.id) return fail(401, "You need to be signed in.");
    if (!isGlmConfigured()) return fail(500, "Job Match is not configured on this server (GLM_API_KEY missing).");
    const uid = session.user.id;

    let body: { jobId?: unknown; resume?: unknown };
    try {
        body = await req.json();
    } catch {
        return fail(400, "Expected a JSON body.");
    }
    if (typeof body.jobId !== "string" || !isResumeData(body.resume)) return fail(400, "Expected `jobId` and `resume`.");
    const resume = body.resume;

    const [job, aliases, candidate] = await Promise.all([readJob(uid, body.jobId), readTagAliases(uid), readCandidateContext(uid)]);
    if (!job) return fail(404, "Job not found.");
    // A run already in flight (another tab, or the analysis that just finished) finishes on its own.
    if (job.match.status === "running") return NextResponse.json({ ok: true, job });

    const timeoutMs = reconcileTimeoutMs(startedAt);
    const match = await markJobMatchRunning(uid, job.id, reconcileRunningMs(timeoutMs), job.match);
    after(() => runReconcileJob(uid, job, resume, aliases, candidate, timeoutMs));
    return NextResponse.json({ ok: true, job: { ...job, match } });
}
