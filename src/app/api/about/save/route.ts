// src/app/api/about/save/route.ts
// POST { answers, followUps, followUpsHash, status: "draft" | "complete" } -> { ok, status, briefUpdated, warning? }.
// Stores the questionnaire in users/{uid}/meta/characterization. Finishing it writes the candidate brief
// (text model, plain text, capped) when the answers changed since the last brief; a failed brief keeps the
// old one (briefStale) so the answers are never lost.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";
import { auth } from "@/auth";
import { chatCompletion, isGlmConfigured, textModel } from "@/lib/glm/client";
import { readCharacterizationDoc, saveCharacterizationDoc } from "@/lib/db/characterization";
import { answersHash, candidateFacts } from "@/lib/about/facts";
import { BRIEF_SYSTEM_PROMPT, briefUserMessage, capBrief } from "@/lib/about/prompt";
import { readAnswers, readFollowUps, type Characterization } from "@/lib/about/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return fail(401, "You need to be signed in.");
    const uid = session.user.id;

    let body: { answers?: unknown; followUps?: unknown; followUpsHash?: unknown; status?: unknown };
    try {
        body = await req.json();
    } catch {
        return fail(400, "Expected a JSON body.");
    }

    try {
        const stored = await readCharacterizationDoc(uid);
        const answers = readAnswers(body.answers);
        const followUps = readFollowUps(body.followUps);
        const finishing = body.status === "complete";
        // Saving a draft after finishing keeps the questionnaire complete.
        const status = finishing || stored.status === "complete" ? "complete" : "draft";
        const facts = candidateFacts(answers);
        const hash = answersHash(answers, followUps);

        const next: Characterization = {
            ...stored,
            status,
            answers,
            followUps,
            followUpsHash: typeof body.followUpsHash === "string" ? body.followUpsHash : stored.followUpsHash,
            answersHash: hash,
            facts,
        };

        let briefUpdated = false;
        let warning: string | undefined;
        if (status === "complete" && hash !== stored.briefHash) {
            try {
                if (!isGlmConfigured()) throw new Error("GLM not configured");
                const result = await chatCompletion(
                    [
                        { role: "system", content: BRIEF_SYSTEM_PROMPT },
                        { role: "user", content: briefUserMessage({ answers, followUps, facts: { careerStage: facts.careerStage, yearsExperience: facts.yearsExperience } }) },
                    ],
                    { model: textModel(), effort: "low", temperature: 0.2, maxTokens: 1500, timeoutMs: 30_000, retries: 0 },
                );
                const brief = capBrief(result.text);
                if (!brief) throw new Error("empty brief");
                Object.assign(next, { brief, briefHash: hash, briefAt: new Date().toISOString(), briefStale: false });
                briefUpdated = true;
            } catch (err) {
                console.error("[about/save] brief failed:", err);
                next.briefStale = true;
                warning = stored.brief
                    ? "Saved. The AI summary could not be refreshed, so the previous one is still used; finish again later to retry."
                    : "Saved. The AI summary could not be written yet; finish again later to retry.";
            }
        }

        await saveCharacterizationDoc(uid, next, {
            ...(finishing && stored.status !== "complete" ? { completedAt: Timestamp.now() } : {}),
        });
        revalidatePath("/dashboard");
        revalidatePath("/dashboard/about");
        return NextResponse.json({ ok: true, status, briefUpdated, warning });
    } catch (err) {
        console.error("[about/save] failed:", err);
        return fail(500, "Could not save your answers.");
    }
}
