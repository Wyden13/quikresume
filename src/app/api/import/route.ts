// src/app/api/import/route.ts
// POST multipart/form-data -> GLM-4.6V -> ResumeData draft (temp ids, nothing
// persisted). A Route Handler rather than a server action so uploads are not
// bound by the 1 MB action body limit and the timeout can be set here.
//
// Fields:
//   file      the original upload (image, .docx, .txt/.md). Optional when `pages` is sent.
//   pages     one or more page images (PNG/JPEG) rendered client-side from a PDF.
//   fileName  display name (defaults to file.name).
//
// GLM rejects `file` parts for every model, so PDFs are rasterised in the
// browser (src/components/ui/resume-import.tsx), DOCX is reduced to text here
// with mammoth, and plain text is sent as-is.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { chatCompletion, GlmError, glmModel, isGlmConfigured, type GlmContentPart } from "@/lib/glm/client";
import { SYSTEM_PROMPT, userInstruction } from "@/lib/import/prompt";
import { ImportParseError, parseModelOutput } from "@/lib/import/parsed-resume";
import { MAX_FILE_BYTES, MAX_PDF_PAGES, type ImportResponse } from "@/lib/import/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // GLM limit per image
const MAX_TEXT_CHARS = 60_000;

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const TEXT_TYPES = new Set(["text/plain", "text/markdown"]);

const fail = (status: number, error: string) => NextResponse.json<ImportResponse>({ ok: false, error }, { status });

const toDataUri = async (blob: Blob, type: string) =>
    `data:${type};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`;

function kindOf(file: File): "image" | "docx" | "text" | "pdf" | null {
    const name = file.name.toLowerCase();
    if (IMAGE_TYPES.has(file.type) || /\.(png|jpe?g|webp)$/.test(name)) return "image";
    if (file.type === DOCX_TYPE || name.endsWith(".docx")) return "docx";
    if (TEXT_TYPES.has(file.type) || /\.(txt|md)$/.test(name)) return "text";
    if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
    return null;
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return fail(401, "You need to be signed in to import a resume.");
    if (!isGlmConfigured()) return fail(500, "Resume import is not configured on this server (GLM_API_KEY missing).");

    const length = Number(req.headers.get("content-length") ?? 0);
    if (length > MAX_FILE_BYTES * 1.5) return fail(413, "That upload is too large. Keep it under 10 MB.");

    let form: FormData;
    try {
        form = await req.formData();
    } catch {
        return fail(400, "Expected a multipart form upload.");
    }

    const file = form.get("file");
    const pages = form.getAll("pages").filter((p): p is File => p instanceof File);
    const fileName = String(form.get("fileName") || (file instanceof File ? file.name : "") || "resume").slice(0, 200);

    const parts: GlmContentPart[] = [];
    let kind: "images" | "text";

    if (pages.length > 0) {
        if (pages.length > MAX_PDF_PAGES) return fail(413, `Only the first ${MAX_PDF_PAGES} pages of a resume can be imported.`);
        for (const page of pages) {
            if (page.size > MAX_IMAGE_BYTES) return fail(413, "A rendered page exceeded 5 MB. Try a smaller PDF.");
            const type = IMAGE_TYPES.has(page.type) ? page.type : "image/png";
            parts.push({ type: "image_url", image_url: { url: await toDataUri(page, type) } });
        }
        kind = "images";
    } else {
        if (!(file instanceof File)) return fail(400, "No file was uploaded.");
        if (file.size === 0) return fail(400, "The uploaded file is empty.");
        if (file.size > MAX_FILE_BYTES) return fail(413, "That file is too large. Keep it under 10 MB.");
        const k = kindOf(file);
        if (k === null) return fail(415, "Unsupported file type. Upload a PDF, DOCX, TXT or an image (PNG/JPG/WebP).");
        if (k === "pdf") return fail(415, "PDFs must be rendered to page images before upload (the app does this automatically).");

        if (k === "image") {
            if (file.size > MAX_IMAGE_BYTES) return fail(413, "Images must be under 5 MB.");
            const type = IMAGE_TYPES.has(file.type) ? file.type : "image/png";
            parts.push({ type: "image_url", image_url: { url: await toDataUri(file, type) } });
            kind = "images";
        } else {
            let text: string;
            if (k === "docx") {
                const mammoth = await import("mammoth");
                try {
                    text = (await mammoth.extractRawText({ buffer: Buffer.from(await file.arrayBuffer()) })).value;
                } catch {
                    return fail(415, "Could not read that DOCX file.");
                }
            } else {
                text = await file.text();
            }
            text = text.replace(/\r\n?/g, "\n").trim();
            if (!text) return fail(415, "That document has no readable text.");
            parts.push({ type: "text", text: `--- RESUME TEXT START ---\n${text.slice(0, MAX_TEXT_CHARS)}\n--- RESUME TEXT END ---` });
            kind = "text";
        }
    }

    parts.unshift({ type: "text", text: userInstruction(kind, fileName) });

    try {
        const result = await chatCompletion([
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: parts },
        ]);
        const parsed = parseModelOutput(result.text);
        return NextResponse.json<ImportResponse>({
            ok: true, data: parsed.data, warnings: parsed.warnings, fileName, model: result.model,
        });
    } catch (err) {
        if (err instanceof ImportParseError) {
            console.error("[import] could not parse model output:", err.message, "\n---\n", err.raw.slice(0, 2000));
            return fail(502, "The AI reply could not be understood. Please try again, or upload a clearer copy of the resume.");
        }
        if (err instanceof GlmError) {
            console.error("[import] GLM error:", err.message);
            return fail(err.status === 401 ? 500 : 502, err.message);
        }
        console.error("[import] unexpected error:", err);
        return fail(500, "Something went wrong while importing the resume.");
    }
}

export async function GET() {
    return NextResponse.json({ model: glmModel(), configured: isGlmConfigured() });
}
