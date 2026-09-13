// src/lib/import/types.ts
// Shared between the /api/import route handler and the client import UI.
import type { ResumeData } from "@/types/schema";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Pages rendered from a PDF beyond this are ignored. */
export const MAX_PDF_PAGES = 8;

export type ImportResponse =
    | { ok: true; data: ResumeData; warnings: string[]; fileName: string; model: string }
    | { ok: false; error: string };
