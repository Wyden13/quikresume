// src/app/api/jobs/reconcile/route.ts
// POST { jobId, resume: ResumeData } -> { ok, job, changed, warning? }.
// Re-runs the "broader context" pass (lib/match/reconcile.ts) for a saved job
// against the resume the user is scoring, and stores the verdicts on the
// job's requirements so every client-side score recompute honours them.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { isGlmConfigured } from "@/lib/glm/client";
import { readTagAliases } from "@/lib/db/meta";
import { patchJob, readJob } from "@/lib/db/jobs";
import { reconcileRequirements } from "@/lib/match/reconcile";
import { isResumeData } from "@/lib/match/resume-body";
import { readCandidateContext } from "@/lib/db/characterization";

export const runtime = "nodejs";
export const maxDuration = 120;

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
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

    const [job, aliases, candidate] = await Promise.all([readJob(uid, body.jobId), readTagAliases(uid), readCandidateContext(uid)]);
    if (!job) return fail(404, "Job not found.");

    const rec = await reconcileRequirements(job.requirements, body.resume, aliases, { candidate });
    if (rec.warning) return fail(502, rec.warning);
    await patchJob(uid, job.id, { requirements: rec.requirements });
    revalidatePath("/dashboard");
    return NextResponse.json({ ok: true, job: { ...job, requirements: rec.requirements }, changed: rec.changed });
}
