// src/app/api/jobs/analyze/route.ts
// POST multipart: `text` (pasted job description) OR the upload contract from
// /api/import (`file` / `pages` / `fileName`). Images are transcribed with
// GLM-4.6V, then the text model extracts structured requirements. When the
// form also carries `resume` (ResumeData as JSON), a second text-model pass
// reconciles the requirements against that resume (lib/match/reconcile.ts).
// Saves the job under users/{uid}/jobs and returns it.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { chatCompletion, GlmError, isGlmConfigured, textModel } from "@/lib/glm/client";
import { formToDocument, isDocumentError, transcribeImages } from "@/lib/import/document-text";
import { extractJson, ImportParseError } from "@/lib/import/parsed-resume";
import { readTagAliases } from "@/lib/db/meta";
import { createJob } from "@/lib/db/jobs";
import { reconcileRequirements } from "@/lib/match/reconcile";
import { isResumeData } from "@/lib/match/resume-body";
import { JD_MAX_CHARS, JD_SYSTEM_PROMPT, jdUserMessage } from "@/lib/match/prompt";
import { makeTag, type AliasMap } from "@/lib/tags/normalize";
import { isTagKind } from "@/lib/tags/types";
import type { Requirement } from "@/lib/match/types";
import type { ResumeData } from "@/types/schema";

export const runtime = "nodejs";
export const maxDuration = 120;

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

function parseRequirements(raw: unknown, aliases: AliasMap): Requirement[] {
    if (!Array.isArray(raw)) return [];
    const out: Requirement[] = [];
    const seen = new Set<string>();
    for (const r of raw) {
        if (!r || typeof r !== "object") continue;
        const o = r as Record<string, unknown>;
        if (typeof o.name !== "string" || !isTagKind(o.kind)) continue;
        const tag = makeTag(o.name, o.kind, aliases);
        if (!tag || seen.has(tag.name)) continue;
        seen.add(tag.name);
        out.push({
            ...tag,
            importance: o.importance === "nice" ? "nice" : "must",
            yearsMin: typeof o.yearsMin === "number" && o.yearsMin > 0 ? Math.round(o.yearsMin) : null,
            satisfiedBy: [], evidence: [], reason: "",
        });
    }
    return out;
}

function parseResumeField(v: FormDataEntryValue | null): ResumeData | null {
    if (typeof v !== "string" || !v) return null;
    try {
        const parsed = JSON.parse(v) as unknown;
        return isResumeData(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return fail(401, "You need to be signed in.");
    if (!isGlmConfigured()) return fail(500, "Job Match is not configured on this server (GLM_API_KEY missing).");
    const uid = session.user.id;

    let form: FormData;
    try {
        form = await req.formData();
    } catch {
        return fail(400, "Expected a multipart form.");
    }

    let jdText = String(form.get("text") ?? "").replace(/\r\n?/g, "\n").trim();
    let source: { kind: "paste" | "file"; fileName: string | null } = { kind: "paste", fileName: null };

    try {
        if (!jdText) {
            const doc = await formToDocument(form, "job-posting");
            if (isDocumentError(doc)) return fail(doc.status, doc.error);
            source = { kind: "file", fileName: doc.fileName };
            jdText = doc.kind === "text" ? (doc.text ?? "") : await transcribeImages(doc.parts, "job posting");
        }
        if (jdText.length < 40) return fail(400, "That job description is too short to analyse.");
        jdText = jdText.slice(0, JD_MAX_CHARS);

        const result = await chatCompletion(
            [{ role: "system", content: JD_SYSTEM_PROMPT }, { role: "user", content: jdUserMessage(jdText) }],
            { model: textModel(), json: true, effort: "low", temperature: 0.1, maxTokens: 6000 },
        );
        const json = extractJson(result.text) as Record<string, unknown>;
        const aliases = await readTagAliases(uid);
        let requirements = parseRequirements(json.requirements, aliases);
        if (requirements.length === 0) return fail(502, "No requirements could be extracted from that text. Try pasting the full posting.");

        let warning: string | undefined;
        const resume = parseResumeField(form.get("resume"));
        if (resume) {
            const rec = await reconcileRequirements(requirements, resume, aliases);
            requirements = rec.requirements;
            warning = rec.warning;
        }

        const job = await createJob(uid, {
            title: String(json.title ?? "").trim().slice(0, 120) || "Untitled job",
            company: String(json.company ?? "").trim().slice(0, 120),
            summary: String(json.summary ?? "").trim().slice(0, 600),
            source,
            jdText,
            requirements,
        });
        revalidatePath("/dashboard");
        return NextResponse.json({ ok: true, job, warning });
    } catch (err) {
        if (err instanceof ImportParseError) {
            console.error("[jobs/analyze] unparseable reply:", err.raw.slice(0, 500));
            return fail(502, "The AI reply could not be understood. Please try again.");
        }
        if (err instanceof GlmError) {
            console.error("[jobs/analyze] GLM error:", err.message);
            return fail(502, err.message);
        }
        console.error("[jobs/analyze]", err);
        return fail(500, "Something went wrong while analysing the job.");
    }
}
