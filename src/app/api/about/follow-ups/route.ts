// src/app/api/about/follow-ups/route.ts
// POST { answers } -> { ok, questions: FollowUp[], coreHash }.
// 3–5 coach questions tailored to the core answers and the library. Nothing is saved here; the
// questions are stored with the answers by /api/about/save.
//
// Guarded (lib/security/guard.ts): same-origin, session, per-user rate limit, daily AI budget.

import { NextResponse } from "next/server";
import { chatCompletion, GlmError, glmErrorStatus, textModel } from "@/lib/glm/client";
import { extractJson } from "@/lib/import/parsed-resume";
import { loadResumeData } from "@/lib/db/load-resume";
import { candidateFacts, coreHash, employmentGaps } from "@/lib/about/facts";
import { FOLLOW_UP_SYSTEM_PROMPT, followUpUserMessage } from "@/lib/about/prompt";
import { recentRoles } from "@/lib/about/library-summary";
import { readAnswers, readFollowUps } from "@/lib/about/types";
import { guardApi } from "@/lib/security/guard";
import { RATE } from "@/lib/security/rate-limit";
import { withAiUser } from "@/lib/security/ai-budget";
import { readJsonBody } from "@/lib/security/request";

export const runtime = "nodejs";
export const maxDuration = 60;

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
    const g = await guardApi(req, RATE.about, { ai: true, feature: "AI questions", what: "questionnaire requests" });
    if (!g.ok) return g.response;

    const parsed = await readJsonBody<{ answers?: unknown }>(req, 256 * 1024);
    if (!parsed.ok) return parsed.response;
    const answers = readAnswers(parsed.body.answers);

    return withAiUser(g.uid, "about", async () => {
        try {
            const data = await loadResumeData(g.uid, g.session.user?.name);
            const facts = candidateFacts(answers);
            const result = await chatCompletion(
                [
                    { role: "system", content: FOLLOW_UP_SYSTEM_PROMPT },
                    {
                        role: "user",
                        content: followUpUserMessage({
                            answers,
                            facts: { careerStage: facts.careerStage, yearsExperience: facts.yearsExperience },
                            recentRoles: recentRoles(data).map(r => ({ title: r.title, company: r.company })),
                            gaps: employmentGaps(data),
                        }),
                    },
                ],
                { model: textModel(), json: true, effort: "low", temperature: 0.4, maxTokens: 2000, timeoutMs: 40_000, retries: 0 },
            );
            const json = extractJson(result.text) as { questions?: unknown };
            const questions = readFollowUps(json.questions).map((q, i) => ({ ...q, id: `q${i + 1}`, answer: "" }));
            if (questions.length === 0) return fail(502, "The AI returned no questions. Try again.");
            return NextResponse.json({ ok: true, questions, coreHash: coreHash(answers) });
        } catch (err) {
            console.error("[about/follow-ups] failed:", err);
            if (err instanceof GlmError && glmErrorStatus(err) === 429) return fail(429, err.message);
            return fail(502, "Could not generate questions right now. You can finish without them.");
        }
    });
}
