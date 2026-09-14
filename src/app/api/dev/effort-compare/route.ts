// src/app/api/dev/effort-compare/route.ts
// Dev only (404 in production). POST { task: "reconcile" | "review" | "tailor", jobId?, efforts?: Effort[], ids?: string[] }
// -> { ok, runs: [{ effort, ms, output | error }] }.
// Runs the real prompt for one task over the signed-in user's library once per reasoning effort
// (sequentially) so the outputs and timings can be compared side by side. Nothing is written.
// Token counts for high / max runs are in the server log (`[glm] ... tokens=`).
//
//   reconcile: jobId required; verdicts per requirement + the resulting score of the working selection
//   review:    up to one chunk (REVIEW_CHUNK) of items, `ids` or the selected items first
//   tailor:    jobId required; the merged include / exclude decisions and hidden lines

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { chatCompletion, isGlmConfigured, textModel } from "@/lib/glm/client";
import { isEffort, maxTokensFor, type Effort } from "@/lib/glm/effort";
import { extractJson } from "@/lib/import/parsed-resume";
import { readTagAliases } from "@/lib/db/meta";
import { readJob, readPreferences } from "@/lib/db/jobs";
import { readCandidateContext } from "@/lib/db/characterization";
import { loadLibraryWithReviews } from "@/lib/db/load-resume";
import { reconcileRequirements } from "@/lib/match/reconcile";
import { scoreJob } from "@/lib/match/score";
import { buildTailorPlan, mergeAiReview, tailorPromptInput } from "@/lib/match/auto-tailor";
import { AUTO_TAILOR_SYSTEM_PROMPT, autoTailorUserMessage } from "@/lib/match/prompt";
import { REVIEW_CHUNK, reviewItems } from "@/lib/review/run";
import { profileReviewInput, reviewInputOf } from "@/lib/review/content";
import { hasContent } from "@/lib/tags/content";
import { RESUME_LIST_KEYS, type ResumeData, type ResumeListKey } from "@/types/schema";

export const runtime = "nodejs";
export const maxDuration = 300;

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

type AnyItem = ResumeData[ResumeListKey][number];

export async function POST(req: Request) {
    if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
    const session = await auth();
    if (!session?.user?.id) return fail(401, "You need to be signed in.");
    if (!isGlmConfigured()) return fail(500, "GLM_API_KEY missing.");
    const uid = session.user.id;

    let body: { task?: unknown; jobId?: unknown; efforts?: unknown; ids?: unknown };
    try {
        body = await req.json();
    } catch {
        return fail(400, "Expected a JSON body.");
    }
    const efforts: Effort[] = Array.isArray(body.efforts) && body.efforts.every(isEffort) && body.efforts.length > 0 ? body.efforts : ["low", "high", "max"];
    const task = body.task;
    if (task !== "reconcile" && task !== "review" && task !== "tailor") return fail(400, "`task` must be reconcile, review or tailor.");

    const [{ data }, aliases, candidate] = await Promise.all([loadLibraryWithReviews(uid, session.user.name), readTagAliases(uid), readCandidateContext(uid)]);
    const job = typeof body.jobId === "string" ? await readJob(uid, body.jobId) : null;
    if (task !== "review" && !job) return fail(400, "`jobId` of an existing job is required for this task.");

    const runs: { effort: Effort; ms: number; output?: unknown; error?: string }[] = [];
    for (const effort of efforts) {
        const started = Date.now();
        try {
            let output: unknown;
            if (task === "reconcile" && job) {
                // Start from verdict-free requirements so every effort is judged on the same input.
                const bare = job.requirements.map(r => ({ ...r, satisfiedBy: [], evidence: [], reason: "" }));
                const rec = await reconcileRequirements(bare, data, aliases, { candidate, effort, timeoutMs: 280_000, retries: 0 });
                if (rec.warning) throw new Error(rec.warning);
                output = {
                    score: Math.round(scoreJob(rec.requirements, data, aliases).score),
                    scoreWithoutReconcile: Math.round(scoreJob(bare, data, aliases).score),
                    verdicts: rec.requirements.filter(r => r.satisfiedBy.length || r.evidence.length)
                        .map(r => ({ requirement: r.display, satisfiedBy: r.satisfiedBy, evidence: r.evidence, reason: r.reason })),
                };
            } else if (task === "review") {
                const wanted = new Set(Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : []);
                const picked = RESUME_LIST_KEYS.flatMap(key => (data[key] as AnyItem[])
                    .filter(item => hasContent(key, item) && (wanted.size === 0 || wanted.has(item.id)))
                    .map(item => ({ input: reviewInputOf(key, item), selected: item.isSelected })));
                picked.sort((a, b) => Number(b.selected) - Number(a.selected));
                const inputs = picked.map(p => p.input);
                if (wanted.size === 0 || wanted.has("profile")) inputs.unshift(profileReviewInput(data.personalInfo));
                const chunk = inputs.slice(0, REVIEW_CHUNK);
                const { byId, skipped } = await reviewItems(chunk, candidate, { effort, budgetMs: 280_000 });
                output = { reviews: chunk.map(c => ({ id: c.id, label: c.label, review: byId[c.id] ?? null })), skipped };
            } else if (task === "tailor" && job) {
                const prefs = await readPreferences(uid);
                const plan = buildTailorPlan(job.requirements, data, prefs.caps, aliases);
                const result = await chatCompletion(
                    [
                        { role: "system", content: AUTO_TAILOR_SYSTEM_PROMPT },
                        { role: "user", content: autoTailorUserMessage({ job: { title: job.title, company: job.company, summary: job.summary }, ...tailorPromptInput(plan, data, job.requirements), candidate }) },
                    ],
                    { model: textModel(), json: true, effort, temperature: 0.2, maxTokens: maxTokensFor(effort, 8000), timeoutMs: 280_000, retries: 0 },
                );
                const merged = mergeAiReview(plan, data, extractJson(result.text));
                output = {
                    tokens: result.usage,
                    changedFromTagPlan: merged.items.filter(d => plan.items.find(p => p.id === d.id)?.include !== d.include)
                        .map(d => ({ label: d.label, include: d.include, reason: d.reason })),
                    included: merged.items.filter(d => d.include).map(d => d.label),
                    hidden: merged.hidden,
                    hiddenReasons: merged.hiddenReasons,
                };
            }
            runs.push({ effort, ms: Date.now() - started, output });
        } catch (err) {
            runs.push({ effort, ms: Date.now() - started, error: err instanceof Error ? err.message : String(err) });
        }
    }
    return NextResponse.json({ ok: true, task, runs });
}
