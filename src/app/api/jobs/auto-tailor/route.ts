// src/app/api/jobs/auto-tailor/route.ts
// POST { jobId, resume: ResumeData } -> { ok, plan, requirements, warning? }.
// 1. reuse the background reconcile verdicts when they match this library, else a quick
//    inline pass (low effort) stored on the job;
// 2. deterministic plan (hard items locked, soft set cover) -> text-model review
//    limited to the soft side (lib/match/auto-tailor.ts). Uncovered hard
//    requirements do not block: the tailor window asks about them first and
//    warns about them. Nothing is persisted besides the reconciled requirements;
//    the window shows the plan as suggestions.
//
// Guarded (lib/security/guard.ts): same-origin, session, per-user rate limit, daily AI budget.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { chatCompletion, GlmError, textModel } from "@/lib/glm/client";
import { extractJson, ImportParseError } from "@/lib/import/parsed-resume";
import { readTagAliases } from "@/lib/db/meta";
import { patchJob, readJob, readPreferences } from "@/lib/db/jobs";
import { reconcileLibraryHash, reconcileRequirements } from "@/lib/match/reconcile";
import { effortFor, maxTokensFor } from "@/lib/glm/effort";
import { readCandidateContext } from "@/lib/db/characterization";
import { readResumeBody } from "@/lib/match/resume-body";
import { buildTailorPlan, mergeAiReview, tailorPromptInput } from "@/lib/match/auto-tailor";
import { AUTO_TAILOR_SYSTEM_PROMPT, autoTailorUserMessage } from "@/lib/match/prompt";
import { guardApi } from "@/lib/security/guard";
import { RATE } from "@/lib/security/rate-limit";
import { withAiUser } from "@/lib/security/ai-budget";
import { readJsonBody } from "@/lib/security/request";

export const runtime = "nodejs";
export const maxDuration = 300;

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
    const g = await guardApi(req, RATE.tailor, { ai: true, feature: "Job Match", what: "tailoring runs" });
    if (!g.ok) return g.response;
    const uid = g.uid;

    const parsed = await readJsonBody<{ jobId?: unknown; resume?: unknown }>(req);
    if (!parsed.ok) return parsed.response;
    const resume = readResumeBody(parsed.body.resume);
    if (typeof parsed.body.jobId !== "string" || !resume) return fail(400, "Expected `jobId` and `resume`.");
    const jobId = parsed.body.jobId;

    return withAiUser(uid, "tailor", async () => {
        try {
            const [job, prefs, aliases, candidate] = await Promise.all([readJob(uid, jobId), readPreferences(uid), readTagAliases(uid), readCandidateContext(uid)]);
            if (!job) return fail(404, "Job not found.");

            // The background pass (max effort) already judged this library: reuse its verdicts. Otherwise
            // (library changed, still running, failed, never run) do a quick inline pass so the plan sees them.
            const current = job.match.status === "done" && job.match.libraryHash === reconcileLibraryHash(job.requirements, resume, candidate);
            const reconciled = current
                ? { requirements: job.requirements, warning: undefined }
                : await reconcileRequirements(job.requirements, resume, aliases, { timeoutMs: 45_000, retries: 0, candidate, effort: "low" });
            const requirements = reconciled.requirements;
            if (!current && !reconciled.warning) await patchJob(uid, job.id, { requirements });

            const plan = buildTailorPlan(requirements, resume, prefs.caps, aliases);
            const warnings: string[] = reconciled.warning ? [`AI match check skipped: ${reconciled.warning}`] : [];
            let reviewed = plan;
            const tailorEffort = effortFor("tailor");
            try {
                const result = await chatCompletion(
                    [
                        { role: "system", content: AUTO_TAILOR_SYSTEM_PROMPT },
                        { role: "user", content: autoTailorUserMessage({ job: { title: job.title, company: job.company, summary: job.summary }, ...tailorPromptInput(plan, resume, requirements), candidate }) },
                    ],
                    { model: textModel(), json: true, effort: tailorEffort, temperature: 0.2, maxTokens: maxTokensFor(tailorEffort, 8000), timeoutMs: 180_000, retries: 0 },
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
            return fail(500, "Auto-tailor failed. Please try again.");
        }
    });
}
