// src/app/api/about/follow-ups/route.ts
// POST { answers } -> { ok, questions: FollowUp[], coreHash }.
// 3–5 coach questions tailored to the core answers and the library. Nothing is saved here; the
// questions are stored with the answers by /api/about/save.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { chatCompletion, isGlmConfigured, textModel } from "@/lib/glm/client";
import { extractJson } from "@/lib/import/parsed-resume";
import { loadResumeData } from "@/lib/db/load-resume";
import { candidateFacts, coreHash, employmentGaps } from "@/lib/about/facts";
import { FOLLOW_UP_SYSTEM_PROMPT, followUpUserMessage } from "@/lib/about/prompt";
import { recentRoles } from "@/lib/about/library-summary";
import { readAnswers, readFollowUps } from "@/lib/about/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return fail(401, "You need to be signed in.");
    if (!isGlmConfigured()) return fail(500, "AI questions are not configured on this server (GLM_API_KEY missing).");

    let body: { answers?: unknown };
    try {
        body = await req.json();
    } catch {
        return fail(400, "Expected a JSON body.");
    }
    const answers = readAnswers(body.answers);

    try {
        const data = await loadResumeData(session.user.id, session.user.name);
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
        return fail(502, "Could not generate questions right now. You can finish without them.");
    }
}
