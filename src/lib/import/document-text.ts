// src/lib/import/document-text.ts
// Server-only: turns the multipart upload contract shared by /api/import and
// /api/jobs/analyze into GLM content parts (page images / image -> image_url,
// DOCX -> mammoth text, TXT -> text), plus a vision-model transcription for
// callers that need plain text out of images.

import "server-only";
import { chatCompletion, type GlmContentPart } from "@/lib/glm/client";
import { MAX_FILE_BYTES, MAX_PDF_PAGES } from "@/lib/import/types";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // GLM limit per image
const MAX_TEXT_CHARS = 60_000;

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const TEXT_TYPES = new Set(["text/plain", "text/markdown"]);

export interface DocumentParts {
    parts: GlmContentPart[];
    kind: "images" | "text";
    fileName: string;
    /** Plain text when `kind === "text"`. */
    text?: string;
}

export interface DocumentError {
    error: string;
    status: number;
}

export const isDocumentError = (r: DocumentParts | DocumentError): r is DocumentError => "error" in r;

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

/**
 * Fields: `file` (image / .docx / .txt / .md; optional when `pages` is sent),
 * `pages` (page images rendered client-side from a PDF), `fileName`.
 */
export async function formToDocument(form: FormData, fallbackName = "document"): Promise<DocumentParts | DocumentError> {
    const file = form.get("file");
    const pages = form.getAll("pages").filter((p): p is File => p instanceof File);
    const fileName = String(form.get("fileName") || (file instanceof File ? file.name : "") || fallbackName).slice(0, 200);

    if (pages.length > 0) {
        if (pages.length > MAX_PDF_PAGES) return { status: 413, error: `Only the first ${MAX_PDF_PAGES} pages can be read.` };
        const parts: GlmContentPart[] = [];
        for (const page of pages) {
            if (page.size > MAX_IMAGE_BYTES) return { status: 413, error: "A rendered page exceeded 5 MB. Try a smaller PDF." };
            const type = IMAGE_TYPES.has(page.type) ? page.type : "image/png";
            parts.push({ type: "image_url", image_url: { url: await toDataUri(page, type) } });
        }
        return { parts, kind: "images", fileName };
    }

    if (!(file instanceof File)) return { status: 400, error: "No file was uploaded." };
    if (file.size === 0) return { status: 400, error: "The uploaded file is empty." };
    if (file.size > MAX_FILE_BYTES) return { status: 413, error: "That file is too large. Keep it under 10 MB." };
    const k = kindOf(file);
    if (k === null) return { status: 415, error: "Unsupported file type. Upload a PDF, DOCX, TXT or an image (PNG/JPG/WebP)." };
    if (k === "pdf") return { status: 415, error: "PDFs must be rendered to page images before upload (the app does this automatically)." };

    if (k === "image") {
        if (file.size > MAX_IMAGE_BYTES) return { status: 413, error: "Images must be under 5 MB." };
        const type = IMAGE_TYPES.has(file.type) ? file.type : "image/png";
        return { parts: [{ type: "image_url", image_url: { url: await toDataUri(file, type) } }], kind: "images", fileName };
    }

    let text: string;
    if (k === "docx") {
        const mammoth = await import("mammoth");
        try {
            text = (await mammoth.extractRawText({ buffer: Buffer.from(await file.arrayBuffer()) })).value;
        } catch {
            return { status: 415, error: "Could not read that DOCX file." };
        }
    } else {
        text = await file.text();
    }
    text = text.replace(/\r\n?/g, "\n").trim().slice(0, MAX_TEXT_CHARS);
    if (!text) return { status: 415, error: "That document has no readable text." };
    return { parts: [{ type: "text", text }], kind: "text", fileName, text };
}

/** Reads page images / a photo with the vision model and returns the plain text. */
export async function transcribeImages(parts: GlmContentPart[], what = "document"): Promise<string> {
    const result = await chatCompletion([
        { role: "system", content: `You transcribe ${what} images into plain text. Reply with the text only, in reading order, preserving headings and bullet points as plain lines. No commentary, no markdown fences.` },
        { role: "user", content: [{ type: "text", text: "Transcribe these pages." }, ...parts] },
    ]);
    return result.text.replace(/\r\n?/g, "\n").trim();
}
