// src/lib/import/pdf-pages.ts
// Browser-only: rasterises a PDF's pages to JPEG blobs with pdf.js so the
// vision model can read them (GLM rejects `file` parts). Shared by the resume
// import and the job-description upload.

import { MAX_PDF_PAGES } from "@/lib/import/types";

export const isPdf = (f: File) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");

/** Rasterises up to MAX_PDF_PAGES pages as JPEGs sized for the vision model. */
export async function renderPdfPages(file: File): Promise<Blob[]> {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
    const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
    const doc = await task.promise;
    const blobs: Blob[] = [];
    try {
        const count = Math.min(doc.numPages, MAX_PDF_PAGES);
        for (let i = 1; i <= count; i++) {
            const page = await doc.getPage(i);
            const base = page.getViewport({ scale: 1 });
            const scale = Math.min(2.5, 1600 / base.width); // ~190 dpi for A4/Letter
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement("canvas");
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("Canvas is not available in this browser.");
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: ctx, viewport, canvas }).promise;
            const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, "image/jpeg", 0.85));
            if (!blob) throw new Error("Could not render a PDF page.");
            blobs.push(blob);
            page.cleanup();
        }
    } finally {
        await task.destroy();
    }
    if (blobs.length === 0) throw new Error("That PDF has no pages.");
    return blobs;
}

/** Builds the multipart body the upload routes expect (`pages` for PDFs, `file` otherwise). */
export async function documentFormData(file: File, onStage?: (label: string) => void): Promise<FormData> {
    const body = new FormData();
    body.set("fileName", file.name);
    if (isPdf(file)) {
        onStage?.("Rendering PDF pages…");
        const pages = await renderPdfPages(file);
        pages.forEach((blob, i) => body.append("pages", blob, `page-${i + 1}.jpg`));
    } else {
        body.set("file", file);
    }
    return body;
}
