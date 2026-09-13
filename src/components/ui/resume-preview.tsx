// src/components/ui/resume-preview.tsx
"use client";

import React, { useEffect, useState } from "react";
import type { ResumeData } from "@/types/schema";
import { pdfFileName, toTypstDoc, type TypstResumeDoc } from "@/lib/typst/doc";
import { compilePdf, compileSvg, ensureTypst, formatTypstError } from "@/lib/typst/client";
import { DEFAULT_TEMPLATE, type TemplateId } from "@/lib/typst/templates";
import { cn } from "@/lib/cn";
import { Button, IconButton } from "@/components/ui/primitives/button";
import { Badge } from "@/components/ui/primitives/badge";
import { Download, X } from "@/components/ui/primitives/icons";

interface ResumePreviewProps {
    resumeData: ResumeData;
    template?: TemplateId;
    /** Pane mode: tighter toolbar with a close button. */
    compact?: boolean;
    onClose?: () => void;
}

type Status = "loading-engine" | "compiling" | "ready" | "error";

const DEBOUNCE_MS = 300;

export function ResumePreview({ resumeData, template = DEFAULT_TEMPLATE, compact = false, onClose }: ResumePreviewProps) {
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
        "loading-engine": "Loading engine…",
        compiling: "Compiling…",
        ready: "Up to date",
        error: "Compile error",
    };

    return (
        <div className={cn("flex flex-col", compact ? "h-full" : "gap-4")}>
            <div className={cn("flex items-center gap-2", compact ? "h-12 shrink-0 border-b border-border px-3" : "flex-wrap")}>
                {compact && <span className="text-13 font-medium">Preview</span>}
                <span className={cn("text-xs", status === "error" ? "text-danger" : "text-fg-subtle", status !== "ready" && status !== "error" && "animate-pulse")}>{statusLabel[status]}</span>
                {pageCount > 0 && <Badge tone={pageCount > 1 ? "warning" : "neutral"}>{pageCount} {pageCount === 1 ? "page" : "pages"}</Badge>}
                <div className="ml-auto flex items-center gap-1">
                    <Button size="sm" variant={compact ? "secondary" : "primary"} icon={Download} onClick={handleDownload} loading={downloading} disabled={status === "loading-engine"}>
                        {downloading ? "Preparing…" : compact ? "PDF" : "Download PDF"}
                    </Button>
                    {compact && onClose && <IconButton icon={X} aria-label="Close preview" onClick={onClose} />}
                </div>
            </div>

            <div className={cn(compact && "min-h-0 flex-1 overflow-y-auto p-4")}>
                {downloadError && <ErrorPanel title="PDF export failed" message={downloadError} />}
                {status === "error" && error && <ErrorPanel title="Typst compile error" message={error} />}
                <div className={cn("mx-auto w-full overflow-hidden", compact ? "" : "max-w-[210mm]")}>
                    {svg ? (
                        <div
                            className={cn(
                                "border border-border bg-white shadow-sm transition-opacity [&>svg]:block [&>svg]:h-auto [&>svg]:w-full",
                                status === "compiling" || status === "error" ? "opacity-60" : "opacity-100",
                            )}
                            dangerouslySetInnerHTML={{ __html: svg }}
                        />
                    ) : (
                        <div className="flex aspect-[210/297] w-full items-center justify-center border border-border bg-white">
                            <span className="text-13 text-fg-subtle">{status === "error" ? "Nothing rendered yet" : statusLabel[status]}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ErrorPanel({ title, message }: { title: string; message: string }) {
    return (
        <div className="mb-4 rounded-md border border-danger-border bg-danger-bg p-3 text-danger">
            <div className="mb-1 text-13 font-medium">{title}</div>
            <pre className="whitespace-pre-wrap break-words font-mono text-xs">{message}</pre>
        </div>
    );
}
