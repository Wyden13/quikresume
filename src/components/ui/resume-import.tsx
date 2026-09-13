// src/components/ui/resume-import.tsx
// Resume import flow: pick one or more files -> (PDF: render pages in the
// browser) -> POST /api/import per file -> combined review -> hand the
// selection to the dashboard, which merges it into the editor draft.
// Nothing is persisted here.
"use client";

import React, { useState } from "react";
import type { PersonalInfo, ResumeData, ResumeListKey } from "@/types/schema";
import { emptyResumeData, RESUME_LIST_KEYS } from "@/types/schema";
import { classifyIncoming, combineParsedFiles, type CombinedImport, type ImportSelection, type ParsedFile } from "@/lib/import/merge";
import { MAX_FILE_BYTES, MAX_PDF_PAGES, type ImportResponse } from "@/lib/import/types";
import { documentFormData } from "@/lib/import/pdf-pages";
import { itemLabel, itemTitle, SECTION_LABEL } from "@/lib/sections";
import { Button } from "@/components/ui/form-controls";

interface ResumeImportProps {
    /** What the library (or the open draft) currently holds; drives the New / Merges / Already labels. */
    current: ResumeData;
    onImport: (selection: ImportSelection, meta: { fileNames: string[] }) => void;
    onCancel: () => void;
}

type FileStatus = "queued" | "rendering" | "reading" | "done" | "failed";
interface QueuedFile { file: File; status: FileStatus; error?: string }

type Stage =
    | { step: "pick"; error: string | null }
    | { step: "working" }
    | { step: "review"; result: CombinedImport };

const ACCEPT = ".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp";
const MAX_FILES = 6;

export function ResumeImport({ current, onImport, onCancel }: ResumeImportProps) {
    const [stage, setStage] = useState<Stage>({ step: "pick", error: null });
    const [queue, setQueue] = useState<QueuedFile[]>([]);
    const [dragOver, setDragOver] = useState(false);

    const addFiles = (list: FileList | File[] | null | undefined) => {
        if (!list) return;
        const incoming = Array.from(list);
        const errors: string[] = [];
        setQueue(prev => {
            const next = [...prev];
            for (const f of incoming) {
                if (next.some(q => q.file.name === f.name && q.file.size === f.size)) continue;
                if (f.size > MAX_FILE_BYTES) { errors.push(`${f.name} is over 10 MB and was skipped.`); continue; }
                if (next.length >= MAX_FILES) { errors.push(`Only ${MAX_FILES} files per import; ${f.name} was skipped.`); continue; }
                next.push({ file: f, status: "queued" });
            }
            return next;
        });
        setStage({ step: "pick", error: errors.length ? errors.join(" ") : null });
    };

    const removeFile = (name: string) => setQueue(prev => prev.filter(q => q.file.name !== name));

    const setStatus = (name: string, status: FileStatus, error?: string) =>
        setQueue(prev => prev.map(q => (q.file.name === name ? { ...q, status, error } : q)));

    const analyze = async () => {
        if (queue.length === 0) return;
        setStage({ step: "working" });
        const parsed: ParsedFile[] = [];
        for (const q of queue) {
            try {
                setStatus(q.file.name, "rendering");
                const body = await documentFormData(q.file);
                setStatus(q.file.name, "reading");
                const res = await fetch("/api/import", { method: "POST", body });
                const json = (await res.json().catch(() => null)) as ImportResponse | null;
                if (!json) throw new Error(`Import failed (${res.status}).`);
                if (!json.ok) throw new Error(json.error);
                parsed.push({ fileName: json.fileName, data: json.data, warnings: json.warnings });
                setStatus(q.file.name, "done");
            } catch (err) {
                setStatus(q.file.name, "failed", err instanceof Error ? err.message : "Import failed.");
            }
        }
        if (parsed.length === 0) {
            setStage({ step: "pick", error: "None of the files could be read. See the errors next to each file." });
            return;
        }
        setStage({ step: "review", result: combineParsedFiles(parsed, emptyResumeData()) });
    };

    if (stage.step === "review") {
        return (
            <ReviewStep
                key={stage.result.fileNames.join("|")}
                result={stage.result}
                current={current}
                onConfirm={(sel) => onImport(sel, { fileNames: stage.result.fileNames })}
                onRestart={() => { setQueue([]); setStage({ step: "pick", error: null }); }}
            />
        );
    }

    const working = stage.step === "working";

    return (
        <div className="bg-white border-2 border-black/5 rounded-[3rem] shadow-2xl shadow-black/5 p-6 md:p-10 space-y-8">
            <div className="space-y-2">
                <h2 className="text-2xl font-black tracking-tight">Import existing resumes</h2>
                <p className="text-black/55 font-medium">
                    Upload one or more PDFs, Word documents, text files or photos of your resumes. GLM-4.6V reads each one
                    and sorts everything into your library sections. Duplicates across files are merged, and you review
                    before anything is saved.
                </p>
            </div>

            {stage.step === "pick" && stage.error && (
                <div role="alert" className="border-2 border-red-200 bg-red-50 rounded-2xl p-5 text-red-800 text-sm font-bold">{stage.error}</div>
            )}

            <label
                onDragOver={(e) => { e.preventDefault(); if (!working) setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!working) addFiles(e.dataTransfer.files); }}
                className={`block cursor-pointer border-2 border-dashed rounded-[2rem] p-10 md:p-14 text-center transition-all ${
                    dragOver ? "border-black bg-black/5" : "border-black/10 bg-gray-50/50 hover:border-black/40"
                } ${working ? "pointer-events-none opacity-60" : ""}`}
            >
                <input type="file" multiple accept={ACCEPT} className="sr-only" disabled={working} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-black/20">
                    <UploadIcon className="w-7 h-7 text-white" />
                </div>
                <p className="font-black text-lg tracking-tight">{queue.length ? "Add another file" : "Drop your resumes here, or click to browse"}</p>
                <p className="text-black/40 text-sm font-bold mt-1">PDF · DOCX · TXT · PNG / JPG · up to 10 MB and {MAX_PDF_PAGES} pages each · {MAX_FILES} files max</p>
            </label>

            {queue.length > 0 && (
                <ul className="space-y-2" aria-live="polite">
                    {queue.map(q => (
                        <li key={q.file.name} className="flex items-center gap-4 p-4 rounded-2xl border-2 border-black/5 bg-white">
                            <StatusDot status={q.status} />
                            <div className="min-w-0 flex-1">
                                <p className="font-black leading-tight break-all">{q.file.name}</p>
                                <p className={`text-[11px] font-bold uppercase tracking-widest ${q.status === "failed" ? "text-red-600 normal-case tracking-normal" : "text-black/40"}`}>
                                    {q.status === "queued" && `${(q.file.size / 1024).toFixed(0)} KB · waiting`}
                                    {q.status === "rendering" && "Rendering pages…"}
                                    {q.status === "reading" && "Reading with GLM-4.6V… up to a minute"}
                                    {q.status === "done" && "Done"}
                                    {q.status === "failed" && (q.error ?? "Failed")}
                                </p>
                            </div>
                            {!working && (
                                <button type="button" onClick={() => removeFile(q.file.name)} className="text-black/30 hover:text-red-500 text-xs font-black uppercase tracking-widest">
                                    Remove
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-6 border-t border-black/5">
                <Button variant="default" onClick={onCancel} disabled={working}>Cancel</Button>
                <Button variant="primary" onClick={analyze} disabled={queue.length === 0} loading={working}>
                    {working ? "Analyzing" : queue.length > 1 ? `Analyze ${queue.length} files` : "Analyze resume"}
                </Button>
            </div>
        </div>
    );
}

function StatusDot({ status }: { status: FileStatus }) {
    if (status === "rendering" || status === "reading") return <span className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin shrink-0" />;
    const cls = status === "done" ? "bg-emerald-500" : status === "failed" ? "bg-red-500" : "bg-black/15";
    return <span className={`w-3 h-3 rounded-full shrink-0 ${cls}`} />;
}

// ---------- Review ----------

interface ReviewStepProps {
    result: CombinedImport;
    current: ResumeData;
    onConfirm: (sel: ImportSelection) => void;
    onRestart: () => void;
}

const PERSONAL_LABEL: Record<keyof PersonalInfo, string> = {
    firstName: "First name", lastName: "Last name", headline: "Headline", email: "Email", phone: "Phone",
    location: "Location", github: "GitHub", linkedin: "LinkedIn", website: "Website", summary: "Summary",
};

function ReviewStep({ result, current, onConfirm, onRestart }: ReviewStepProps) {
    const { data, warnings, fileNames, sourceById } = result;
    const multi = fileNames.length > 1;

    // Classify once per item against the library / open draft.
    const classes: Record<string, ReturnType<typeof classifyIncoming>> = {};
    for (const key of RESUME_LIST_KEYS) {
        for (const item of data[key] as ResumeData[typeof key][number][]) classes[item.id] = classifyIncoming(current, key, item);
    }

    const [checked, setChecked] = useState<Record<string, boolean>>(() => {
        const init: Record<string, boolean> = {};
        for (const key of RESUME_LIST_KEYS) for (const item of data[key]) init[item.id] = classes[item.id]?.kind !== "same";
        return init;
    });
    const parsedPersonal = (Object.keys(PERSONAL_LABEL) as (keyof PersonalInfo)[]).filter(f => data.personalInfo[f].trim());
    const [applyPersonal, setApplyPersonal] = useState(parsedPersonal.length > 0);
    const [replacePersonal, setReplacePersonal] = useState(false);

    const total = RESUME_LIST_KEYS.reduce((n, key) => n + data[key].length, 0);
    const selectedCount = Object.values(checked).filter(Boolean).length;
    const counts = { new: 0, merge: 0, same: 0 };
    for (const c of Object.values(classes)) counts[c.kind]++;
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

    const warningCount = warnings.reduce((n, w) => n + w.warnings.length, 0);

    return (
        <div className="bg-white border-2 border-black/5 rounded-[3rem] shadow-2xl shadow-black/5 p-6 md:p-10 space-y-10">
            <div className="space-y-2">
                <h2 className="text-2xl font-black tracking-tight">Review what we found</h2>
                <p className="text-black/55 font-medium">
                    From <span className="font-bold text-black">{fileNames.join(", ")}</span>: {total} {total === 1 ? "item" : "items"}
                    {parsedPersonal.length > 0 ? " plus personal details" : ""}.
                    {counts.new > 0 && ` ${counts.new} new.`}
                    {counts.merge > 0 && ` ${counts.merge} will add detail to items you already have.`}
                    {counts.same > 0 && ` ${counts.same} already in your library (unticked).`}
                    {" "}You can edit every field afterwards in the Master Editor.
                </p>
            </div>

            {total === 0 && parsedPersonal.length === 0 && (
                <div className="border-2 border-amber-200 bg-amber-50 rounded-2xl p-5 text-amber-900 text-sm font-bold">
                    Nothing usable was found. Try a clearer scan or a text-based PDF.
                </div>
            )}

            {warningCount > 0 && (
                <details className="border-2 border-amber-200 bg-amber-50 rounded-2xl p-5 text-amber-900 text-sm">
                    <summary className="font-black cursor-pointer">{warningCount} {warningCount === 1 ? "entry was" : "entries were"} skipped</summary>
                    {warnings.map(w => (
                        <div key={w.fileName} className="mt-3">
                            {multi && <p className="font-black text-[11px] uppercase tracking-widest">{w.fileName}</p>}
                            <ul className="list-disc ml-5 mt-1 space-y-1">{w.warnings.map((x, i) => <li key={i}>{x}</li>)}</ul>
                        </div>
                    ))}
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
                                const { title, subtitle, meta } = itemLabel(key, item);
                                const cls = classes[item.id];
                                return (
                                    <li key={item.id}>
                                        <label className={`flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${checked[item.id] ? "border-black/10 bg-white" : "border-transparent bg-gray-50 opacity-60"}`}>
                                            <input type="checkbox" checked={Boolean(checked[item.id])} onChange={(e) => setChecked(prev => ({ ...prev, [item.id]: e.target.checked }))} className="w-5 h-5 mt-0.5 accent-black shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-black leading-tight break-words">{title || <span className="text-black/30">Untitled</span>}</p>
                                                    <ClassChip cls={cls} sectionKey={key} />
                                                </div>
                                                {subtitle && <p className="text-sm text-black/60 font-medium break-words">{subtitle}</p>}
                                                <p className="text-[11px] text-black/40 font-black uppercase tracking-widest mt-1">
                                                    {[meta, multi ? sourceById[item.id] : ""].filter(Boolean).join(" · ")}
                                                </p>
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

function ClassChip({ cls, sectionKey }: { cls: ReturnType<typeof classifyIncoming> | undefined; sectionKey: ResumeListKey }) {
    if (!cls || cls.kind === "new") return <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest">New</span>;
    if (cls.kind === "merge") {
        const into = cls.existing ? itemTitle(sectionKey, cls.existing) : "";
        return <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest" title={into ? `Merges into ${into}` : undefined}>Adds detail</span>;
    }
    return <span className="px-2 py-0.5 rounded-md bg-gray-100 text-black/50 text-[10px] font-black uppercase tracking-widest">Already in library</span>;
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
