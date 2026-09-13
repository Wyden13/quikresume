// src/app/api/jobs/auto-tailor/route.ts
// POST { jobId, resume: ResumeData } -> { ok, plan, requirements, warning? }.
// 1. reconcile requirements against the library (semantic matches), stored on the job;
// 2. deterministic plan (hard items locked, soft set cover) -> text-model review
//    limited to the soft side (lib/match/auto-tailor.ts). Uncovered hard
//    requirements do not block: the tailor window asks about them first and
//    warns about them. Nothing is persisted besides the reconciled requirements;
//    the window shows the plan as suggestions.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { chatCompletion, GlmError, isGlmConfigured, textModel } from "@/lib/glm/client";
import { extractJson, ImportParseError } from "@/lib/import/parsed-resume";
import { readTagAliases } from "@/lib/db/meta";
import { patchJob, readJob, readPreferences } from "@/lib/db/jobs";
import { reconcileRequirements } from "@/lib/match/reconcile";
import { isResumeData } from "@/lib/match/resume-body";
import { buildTailorPlan, mergeAiReview, tailorPromptInput } from "@/lib/match/auto-tailor";
import { AUTO_TAILOR_SYSTEM_PROMPT, autoTailorUserMessage } from "@/lib/match/prompt";

export const runtime = "nodejs";
export const maxDuration = 120;

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
    try {
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

        const [job, prefs, aliases] = await Promise.all([readJob(uid, body.jobId), readPreferences(uid), readTagAliases(uid)]);
        if (!job) return fail(404, "Job not found.");

        const reconciled = await reconcileRequirements(job.requirements, resume, aliases, { timeoutMs: 45_000, retries: 0 });
        const requirements = reconciled.requirements;
        await patchJob(uid, job.id, { requirements });

        const plan = buildTailorPlan(requirements, resume, prefs.caps, aliases);
        const warnings: string[] = reconciled.warning ? [`AI match check skipped: ${reconciled.warning}`] : [];
        let reviewed = plan;
        try {
            const result = await chatCompletion(
                [
                    { role: "system", content: AUTO_TAILOR_SYSTEM_PROMPT },
                    { role: "user", content: autoTailorUserMessage({ job: { title: job.title, company: job.company, summary: job.summary }, ...tailorPromptInput(plan, resume, requirements) }) },
                ],
                { model: textModel(), json: true, effort: "low", temperature: 0.2, maxTokens: 8000, timeoutMs: 60_000, retries: 0 },
            );
            reviewed = mergeAiReview(plan, resume, extractJson(result.text));
        } catch (err) {
            if (err instanceof ImportParseError) console.error("[jobs/auto-tailor] unparseable reply:", err.raw.slice(0, 500));
            else console.error("[jobs/auto-tailor]", err);
            warnings.push(`The AI review did not finish (${err instanceof GlmError ? err.message : "unreadable reply"}); showing the tag-based decisions.`);
        }

        revalidatePath("/dashboard");
        return NextResponse.json({ ok: true, plan: reviewed, requirements, warning: warnings.join(" ") || undefined });
    } catch (err) {
        console.error("[jobs/auto-tailor] failed:", err);
        return fail(500, err instanceof Error ? err.message : "Auto-tailor failed.");
    }
}
