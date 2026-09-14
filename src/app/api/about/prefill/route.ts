// src/app/api/about/prefill/route.ts
// POST (no body) -> { ok, computed, gaps, suggestions, warning? }.
// Suggested answers for the "About you" questionnaire: deterministic facts from the library dates
// (years of experience, education status, employment gaps), then the text model's guesses for field,
// target roles, seniority, industries, strengths and career change. Nothing is saved; the user confirms.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { chatCompletion, isGlmConfigured, textModel } from "@/lib/glm/client";
import { extractJson } from "@/lib/import/parsed-resume";
import { loadResumeData } from "@/lib/db/load-resume";
import { aggregateTags } from "@/lib/tags/aggregate";
import { educationStatusOf, employmentGaps, yearsOfExperience } from "@/lib/about/facts";
import { PREFILL_SYSTEM_PROMPT, prefillUserMessage } from "@/lib/about/prompt";
import { educationRows, libraryIsEmpty, recentRoles } from "@/lib/about/library-summary";
import { readAnswers } from "@/lib/about/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function POST() {
    const session = await auth();
    if (!session?.user?.id) return fail(401, "You need to be signed in.");

    try {
        const data = await loadResumeData(session.user.id, session.user.name);
        const years = yearsOfExperience(data);
        const edu = educationStatusOf(data);
        const gaps = employmentGaps(data);
        const computed = { yearsExperience: years, educationStatus: edu.status, graduation: edu.graduation };

        if (libraryIsEmpty(data) || !isGlmConfigured()) {
            return NextResponse.json({ ok: true, computed, gaps, suggestions: null });
        }

        try {
            const result = await chatCompletion(
                [
                    { role: "system", content: PREFILL_SYSTEM_PROMPT },
                    {
                        role: "user",
                        content: prefillUserMessage({
                            headline: data.personalInfo.headline,
                            summary: data.personalInfo.summary.slice(0, 800),
                            recentRoles: recentRoles(data),
                            education: educationRows(data),
                            topTags: aggregateTags(data, { selectedOnly: false }).slice(0, 30).map(t => ({ name: t.display, kind: t.kind, weight: t.weight })),
                            computed,
                        }),
                    },
                ],
                { model: textModel(), json: true, effort: "low", temperature: 0.2, maxTokens: 2000, timeoutMs: 40_000, retries: 0 },
            );
            // Only the fields the model is allowed to suggest survive the lenient reader.
            const a = readAnswers(extractJson(result.text));
            const suggestions = {
                field: a.field, targetRoles: a.targetRoles.slice(0, 3), targetSeniority: a.targetSeniority,
                targetIndustries: a.targetIndustries.slice(0, 3), strengths: a.strengths, careerChange: a.careerChange,
            };
            return NextResponse.json({ ok: true, computed, gaps, suggestions });
        } catch (err) {
            console.error("[about/prefill] model failed:", err);
            return NextResponse.json({ ok: true, computed, gaps, suggestions: null, warning: "AI suggestions are unavailable right now; the dates-based answers are filled in." });
        }
    } catch (err) {
        console.error("[about/prefill] failed:", err);
        return fail(500, "Could not read your library.");
    }
}
