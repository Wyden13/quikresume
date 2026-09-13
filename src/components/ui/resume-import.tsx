// src/components/ui/resume-import.tsx
// Resume import flow: pick a file -> (PDF: render pages in the browser) ->
// POST /api/import -> review parsed items -> hand the selection to the
// dashboard, which merges it into the editor draft. Nothing is persisted here.
"use client";

import React, { useState } from "react";
import type { PersonalInfo, ResumeData, ResumeListKey } from "@/types/schema";
import { RESUME_LIST_KEYS } from "@/types/schema";
import type { ImportSelection } from "@/lib/import/merge";
import { MAX_FILE_BYTES, MAX_PDF_PAGES, type ImportResponse } from "@/lib/import/types";
import { formatDateRange, formatMonthYear } from "@/lib/dates";
import { Button } from "@/components/ui/form-controls";

interface ResumeImportProps {
    /** What the library currently holds; used to explain the personal-info merge rule. */
    current: ResumeData;
    onImport: (selection: ImportSelection, meta: { fileName: string }) => void;
    onCancel: () => void;
}

type Stage =
    | { step: "pick"; error: string | null }
    | { step: "working"; label: string }
    | { step: "review"; result: Extract<ImportResponse, { ok: true }> };

const ACCEPT = ".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp";

export function ResumeImport({ current, onImport, onCancel }: ResumeImportProps) {
    const [stage, setStage] = useState<Stage>({ step: "pick", error: null });
    const [file, setFile] = useState<File | null>(null);
    const [dragOver, setDragOver] = useState(false);

    const pickFile = (f: File | null | undefined) => {
        if (!f) return;
        if (f.size > MAX_FILE_BYTES) {
            setStage({ step: "pick", error: "That file is over 10 MB. Please upload a smaller copy." });
            return;
        }
        setFile(f);
        setStage({ step: "pick", error: null });
    };

    const analyze = async () => {
        if (!file) return;
        try {
            const body = new FormData();
            body.set("fileName", file.name);
            if (isPdf(file)) {
                setStage({ step: "working", label: "Rendering PDF pages…" });
                const pages = await renderPdfPages(file);
                pages.forEach((blob, i) => body.append("pages", blob, `page-${i + 1}.jpg`));
            } else {
                body.set("file", file);
            }
            setStage({ step: "working", label: "Reading your resume with GLM-4.6V… this can take up to a minute." });
            const res = await fetch("/api/import", { method: "POST", body });
            const json = (await res.json().catch(() => null)) as ImportResponse | null;
            if (!json) throw new Error(`Import failed (${res.status}).`);
            if (!json.ok) throw new Error(json.error);
            setStage({ step: "review", result: json });
        } catch (err) {
            setStage({ step: "pick", error: err instanceof Error ? err.message : "Import failed. Please try again." });
        }
    };

    if (stage.step === "review") {
        return (
            <ReviewStep
                key={stage.result.fileName}
                result={stage.result}
                current={current}
                onConfirm={(sel) => onImport(sel, { fileName: stage.result.fileName })}
                onRestart={() => { setFile(null); setStage({ step: "pick", error: null }); }}
            />
        );
    }

    const working = stage.step === "working";

    return (
        <div className="bg-white border-2 border-black/5 rounded-[3rem] shadow-2xl shadow-black/5 p-6 md:p-10 space-y-8">
            <div className="space-y-2">
                <h2 className="text-2xl font-black tracking-tight">Import an existing resume</h2>
                <p className="text-black/55 font-medium">
                    Upload a PDF, Word document, text file or a photo of your resume. GLM-4.6V reads it and sorts
                    everything into your library sections. You review before anything is saved.
                </p>
            </div>

            {stage.step === "pick" && stage.error && (
                <div role="alert" className="border-2 border-red-200 bg-red-50 rounded-2xl p-5 text-red-800 text-sm font-bold">{stage.error}</div>
            )}

            <label
                onDragOver={(e) => { e.preventDefault(); if (!working) setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!working) pickFile(e.dataTransfer.files?.[0]); }}
                className={`block cursor-pointer border-2 border-dashed rounded-[2rem] p-10 md:p-16 text-center transition-all ${
                    dragOver ? "border-black bg-black/5" : "border-black/10 bg-gray-50/50 hover:border-black/40"
                } ${working ? "pointer-events-none opacity-60" : ""}`}
            >
                <input type="file" accept={ACCEPT} className="sr-only" disabled={working} onChange={(e) => pickFile(e.target.files?.[0])} />
                <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-black/20">
                    <UploadIcon className="w-7 h-7 text-white" />
                </div>
                {file ? (
                    <>
                        <p className="font-black text-lg tracking-tight break-all">{file.name}</p>
                        <p className="text-black/40 text-sm font-bold mt-1">{(file.size / 1024).toFixed(0)} KB · click to choose a different file</p>
                    </>
                ) : (
                    <>
                        <p className="font-black text-lg tracking-tight">Drop your resume here, or click to browse</p>
                        <p className="text-black/40 text-sm font-bold mt-1">PDF · DOCX · TXT · PNG / JPG · up to 10 MB, {MAX_PDF_PAGES} pages</p>
                    </>
                )}
            </label>

            {working && (
                <div className="flex items-center gap-3 text-sm font-bold text-black/60" aria-live="polite">
                    <span className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    {stage.label}
                </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-6 border-t border-black/5">
                <Button variant="default" onClick={onCancel} disabled={working}>Cancel</Button>
                <Button variant="primary" onClick={analyze} disabled={!file} loading={working}>
                    {working ? "Analyzing" : "Analyze resume"}
                </Button>
            </div>
        </div>
    );
}

// ---------- Review ----------

interface ReviewStepProps {
    result: Extract<ImportResponse, { ok: true }>;
    current: ResumeData;
    onConfirm: (sel: ImportSelection) => void;
    onRestart: () => void;
}

const SECTION_LABEL: Record<ResumeListKey, string> = {
    workExperience: "Work Experience", education: "Education", skills: "Skill Categories", projects: "Projects",
    certifications: "Certifications", awards: "Awards & Honors", volunteering: "Volunteering & Leadership",
    publications: "Publications", languages: "Languages",
};

const PERSONAL_LABEL: Record<keyof PersonalInfo, string> = {
    firstName: "First name", lastName: "Last name", headline: "Headline", email: "Email", phone: "Phone",
    location: "Location", github: "GitHub", linkedin: "LinkedIn", website: "Website", summary: "Summary",
};

function ReviewStep({ result, current, onConfirm, onRestart }: ReviewStepProps) {
    const { data, warnings, fileName } = result;
    const [checked, setChecked] = useState<Record<string, boolean>>(() => {
        const init: Record<string, boolean> = {};
        for (const key of RESUME_LIST_KEYS) for (const item of data[key]) init[item.id] = true;
        return init;
    });
    const parsedPersonal = (Object.keys(PERSONAL_LABEL) as (keyof PersonalInfo)[]).filter(f => data.personalInfo[f].trim());
    const [applyPersonal, setApplyPersonal] = useState(parsedPersonal.length > 0);
    const [replacePersonal, setReplacePersonal] = useState(false);

    const total = RESUME_LIST_KEYS.reduce((n, key) => n + data[key].length, 0);
    const selectedCount = Object.values(checked).filter(Boolean).length;
    const toggleSection = (key: ResumeListKey, value: boolean) =>
        setChecked(prev => {
            const next = { ...prev };
            for (const item of data[key]) next[item.id] = value;
            return next;
        });

    const confirm = () => {
        const items: ImportSelection["items"] = {};
        for (const key of RESUME_LIST_KEYS) {
            const picked = (data[key] as ResumeData[typeof key][number][]).filter(it => checked[it.id]);
            if (picked.length) (items[key] as unknown[]) = picked;
        }
        onConfirm({ personalInfo: applyPersonal ? data.personalInfo : null, replacePersonal, items });
    };

    return (
        <div className="bg-white border-2 border-black/5 rounded-[3rem] shadow-2xl shadow-black/5 p-6 md:p-10 space-y-10">
            <div className="space-y-2">
                <h2 className="text-2xl font-black tracking-tight">Review what we found</h2>
                <p className="text-black/55 font-medium">
                    From <span className="font-bold text-black">{fileName}</span>: {total} {total === 1 ? "item" : "items"}
                    {parsedPersonal.length > 0 ? " plus personal details" : ""}. Untick anything you don&apos;t want. You can edit every field afterwards in the Master Editor.
                </p>
            </div>

            {total === 0 && parsedPersonal.length === 0 && (
                <div className="border-2 border-amber-200 bg-amber-50 rounded-2xl p-5 text-amber-900 text-sm font-bold">
                    Nothing usable was found in that file. Try a clearer scan or a text-based PDF.
                </div>
            )}

            {warnings.length > 0 && (
                <details className="border-2 border-amber-200 bg-amber-50 rounded-2xl p-5 text-amber-900 text-sm">
                    <summary className="font-black cursor-pointer">{warnings.length} {warnings.length === 1 ? "entry was" : "entries were"} skipped</summary>
                    <ul className="list-disc ml-5 mt-3 space-y-1">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                </details>
            )}

            {parsedPersonal.length > 0 && (
                <section className="space-y-4">
                    <label className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-2xl border border-black/5 cursor-pointer">
                        <div>
                            <span className="block text-sm font-black uppercase tracking-tight">Personal details</span>
                            <span className="block text-[11px] text-black/40 font-bold uppercase tracking-widest">
                                {replacePersonal ? "Overwrites your current details" : "Fills in only the fields you left empty"}
                            </span>
                        </div>
                        <input type="checkbox" checked={applyPersonal} onChange={(e) => setApplyPersonal(e.target.checked)} className="w-6 h-6 accent-black" />
                    </label>
                    {applyPersonal && (
                        <>
                            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 px-2">
                                {parsedPersonal.map(f => {
                                    const existing = current.personalInfo[f].trim();
                                    const willApply = replacePersonal || !existing;
                                    return (
                                        <div key={f} className={`flex gap-3 text-sm py-1 ${willApply ? "" : "opacity-40"}`}>
                                            <dt className="w-24 shrink-0 font-black uppercase tracking-widest text-[10px] text-black/40 pt-1">{PERSONAL_LABEL[f]}</dt>
                                            <dd className="font-medium break-words min-w-0">{data.personalInfo[f]}{!willApply && <span className="text-black/50"> (kept: {existing})</span>}</dd>
                                        </div>
                                    );
                                })}
                            </dl>
                            <label className="flex items-center gap-3 px-2 text-sm font-bold cursor-pointer">
                                <input type="checkbox" checked={replacePersonal} onChange={(e) => setReplacePersonal(e.target.checked)} className="w-5 h-5 accent-black" />
                                Replace my existing details with these
                            </label>
                        </>
                    )}
                </section>
            )}

            {RESUME_LIST_KEYS.filter(key => data[key].length > 0).map(key => {
                const items = data[key] as ResumeData[typeof key][number][];
                const picked = items.filter(it => checked[it.id]).length;
                return (
                    <section key={key} className="space-y-3">
                        <div className="flex items-center justify-between gap-4">
                            <h3 className="text-lg font-black tracking-tight uppercase">
                                {SECTION_LABEL[key]} <span className="text-black/30 text-sm">{picked}/{items.length}</span>
                            </h3>
                            <button type="button" onClick={() => toggleSection(key, picked !== items.length)} className="text-xs font-black uppercase tracking-widest text-black/40 hover:text-black">
                                {picked === items.length ? "Untick all" : "Tick all"}
                            </button>
                        </div>
                        <ul className="space-y-2">
                            {items.map(item => {
                                const { title, subtitle, meta } = summarize(key, item);
                                return (
                                    <li key={item.id}>
                                        <label className={`flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${checked[item.id] ? "border-black/10 bg-white" : "border-transparent bg-gray-50 opacity-60"}`}>
                                            <input type="checkbox" checked={Boolean(checked[item.id])} onChange={(e) => setChecked(prev => ({ ...prev, [item.id]: e.target.checked }))} className="w-5 h-5 mt-0.5 accent-black shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <p className="font-black leading-tight break-words">{title || <span className="text-black/30">Untitled</span>}</p>
                                                {subtitle && <p className="text-sm text-black/60 font-medium break-words">{subtitle}</p>}
                                                {meta && <p className="text-[11px] text-black/40 font-black uppercase tracking-widest mt-1">{meta}</p>}
                                            </div>
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                );
            })}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-6 border-t border-black/5">
                <Button variant="default" onClick={onRestart}>Start over</Button>
                <Button variant="primary" onClick={confirm} disabled={selectedCount === 0 && !applyPersonal}>
                    Add {selectedCount} {selectedCount === 1 ? "item" : "items"} to Master Editor
                </Button>
            </div>
        </div>
    );
}

function summarize<K extends ResumeListKey>(key: K, item: ResumeData[K][number]): { title: string; subtitle: string; meta: string } {
    switch (key) {
        case "workExperience": { const x = item as ResumeData["workExperience"][number]; return { title: x.title, subtitle: x.company, meta: formatDateRange(x.startDate, x.endDate) }; }
        case "education": { const x = item as ResumeData["education"][number]; return { title: x.degree, subtitle: x.institution, meta: formatDateRange(x.startDate, x.endDate) }; }
        case "skills": { const x = item as ResumeData["skills"][number]; return { title: x.category, subtitle: x.items, meta: "" }; }
        case "projects": { const x = item as ResumeData["projects"][number]; return { title: x.title, subtitle: x.stack, meta: formatDateRange(x.startDate, x.endDate) }; }
        case "certifications": { const x = item as ResumeData["certifications"][number]; return { title: x.name, subtitle: x.issuer, meta: x.year }; }
        case "awards": { const x = item as ResumeData["awards"][number]; return { title: x.title, subtitle: x.issuer, meta: formatMonthYear(x.date) }; }
        case "volunteering": { const x = item as ResumeData["volunteering"][number]; return { title: x.role, subtitle: x.organization, meta: formatDateRange(x.startDate, x.endDate) }; }
        case "publications": { const x = item as ResumeData["publications"][number]; return { title: x.title, subtitle: [x.authors, x.venue].filter(Boolean).join(" · "), meta: formatMonthYear(x.date) }; }
        case "languages": { const x = item as ResumeData["languages"][number]; return { title: x.language, subtitle: x.proficiency, meta: "" }; }
    }
    return { title: "", subtitle: "", meta: "" };
}

// ---------- PDF -> page images (browser only) ----------

const isPdf = (f: File) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");

/** Rasterises up to MAX_PDF_PAGES pages as JPEGs sized for the vision model. */
async function renderPdfPages(file: File): Promise<Blob[]> {
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

function UploadIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
    );
}
