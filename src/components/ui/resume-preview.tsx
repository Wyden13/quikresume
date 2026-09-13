// src/components/ui/resume-preview.tsx
"use client";

import React, { useEffect, useState } from "react";
import type { ResumeData } from "@/types/schema";
import { pdfFileName, toTypstDoc, type TypstResumeDoc } from "@/lib/typst/doc";
import { compilePdf, compileSvg, ensureTypst, formatTypstError } from "@/lib/typst/client";
import { DEFAULT_TEMPLATE, type TemplateId } from "@/lib/typst/templates";

interface ResumePreviewProps {
    resumeData: ResumeData;
    template?: TemplateId;
}

type Status = "loading-engine" | "compiling" | "ready" | "error";

const DEBOUNCE_MS = 300;

export function ResumePreview({ resumeData, template = DEFAULT_TEMPLATE }: ResumePreviewProps) {
    // Key the effect on the serialized document so object identity churn never
    // triggers a recompile; only real content changes do.
    const docJson = JSON.stringify(toTypstDoc(resumeData));

    const [svg, setSvg] = useState<string | null>(null);
    const [pageCount, setPageCount] = useState(0);
    const [status, setStatus] = useState<Status>("loading-engine");
    const [error, setError] = useState<string | null>(null);
    const [downloading, setDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const timer = setTimeout(async () => {
            const doc = JSON.parse(docJson) as TypstResumeDoc;
            try {
                await ensureTypst();
                if (cancelled) return;
                setStatus("compiling");
                const result = await compileSvg(doc, template);
                if (cancelled) return;
                setSvg(result.svg);
                setPageCount(result.pageCount);
                setError(null);
                setStatus("ready");
            } catch (err) {
                if (cancelled) return;
                setError(formatTypstError(err));
                setStatus("error");
            }
        }, DEBOUNCE_MS);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [docJson, template]);

    const handleDownload = async () => {
        setDownloading(true);
        setDownloadError(null);
        try {
            const doc = JSON.parse(docJson) as TypstResumeDoc;
            const bytes = await compilePdf(doc, template);
            const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = pdfFileName(resumeData.personalInfo);
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            setDownloadError(formatTypstError(err));
        } finally {
            setDownloading(false);
        }
    };

    const statusLabel: Record<Status, string> = {
        "loading-engine": "Loading Typst engine…",
        compiling: "Compiling…",
        ready: "Up to date",
        error: "Compile error",
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-black uppercase tracking-widest">
                    <span
                        className={`px-3 py-1.5 rounded-full border-2 ${
                            status === "error"
                                ? "border-red-500 text-red-600"
                                : status === "ready"
                                    ? "border-black/10 text-black/50"
                                    : "border-black/10 text-black/30 animate-pulse"
                        }`}
                    >
                        {statusLabel[status]}
                    </span>
                    {pageCount > 0 && (
                        <span className={`px-3 py-1.5 rounded-full border-2 ${pageCount > 1 ? "border-amber-400 text-amber-600" : "border-black/10 text-black/50"}`}>
                            {pageCount} {pageCount === 1 ? "page" : "pages"}
                        </span>
                    )}
                </div>
                <button
                    onClick={handleDownload}
                    disabled={downloading || status === "loading-engine"}
                    className="bg-black text-white px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg hover:bg-black/80 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center gap-3"
                >
                    <DownloadIcon className="w-4 h-4" />
                    {downloading ? "Preparing…" : "Download PDF"}
                </button>
            </div>

            {downloadError && (
                <ErrorPanel title="PDF export failed" message={downloadError} />
            )}
            {status === "error" && error && (
                <ErrorPanel title="Typst compile error" message={error} />
            )}

            {/* Document */}
            <div className="mx-auto w-full max-w-[210mm] overflow-hidden">
                {svg ? (
                    <div
                        className={`bg-white shadow-2xl transition-opacity [&>svg]:block [&>svg]:w-full [&>svg]:h-auto ${
                            status === "compiling" || status === "error" ? "opacity-60" : "opacity-100"
                        }`}
                        dangerouslySetInnerHTML={{ __html: svg }}
                    />
                ) : (
                    <div className="aspect-[210/297] w-full bg-white shadow-2xl flex items-center justify-center">
                        <span className="text-black/30 font-bold uppercase tracking-widest text-xs">
                            {status === "error" ? "Nothing rendered yet" : statusLabel[status]}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

function ErrorPanel({ title, message }: { title: string; message: string }) {
    return (
        <div className="border-2 border-red-200 bg-red-50 rounded-2xl p-5 text-red-800">
            <div className="text-[11px] font-black uppercase tracking-widest mb-2">{title}</div>
            <pre className="text-xs whitespace-pre-wrap break-words font-mono">{message}</pre>
        </div>
    );
}

function DownloadIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
    );
}
