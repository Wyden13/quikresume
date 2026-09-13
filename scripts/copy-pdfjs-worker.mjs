// scripts/copy-pdfjs-worker.mjs
// Copies the pdf.js worker into public/pdfjs so the browser can load it by URL
// (resume import renders uploaded PDFs to page images client-side before
// sending them to GLM-4.6V). Runs on `npm install`; output dir is gitignored.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const src = join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const outDir = join(root, "public", "pdfjs");

if (!existsSync(src)) {
    console.warn(`[pdfjs] missing ${src} - run npm install first`);
} else {
    mkdirSync(outDir, { recursive: true });
    copyFileSync(src, join(outDir, "pdf.worker.min.mjs"));
    console.log("[pdfjs] copied pdf.worker.min.mjs -> public/pdfjs/");
}
