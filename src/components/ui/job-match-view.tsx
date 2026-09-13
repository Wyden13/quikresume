// src/components/ui/job-match-view.tsx
"use client";

// Job Match: analyse a job description, score a resume source against it
// (working selection / saved variant / uploaded resume), inspect the ATS
// keyword table, and work through AI proposals.

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { ResumeData } from "@/types/schema";
import type { ResumeVariant } from "@/types/db";
import type { JobRecord, MuteRule, Preferences, Proposal, Requirement, ResumeSource } from "@/lib/match/types";
import type { AliasMap } from "@/lib/tags/normalize";
import { jobKindTotals, scoreJob } from "@/lib/match/score";
import { muteRuleFor } from "@/lib/match/proposals";
import { aggregateTags, kindTotals } from "@/lib/tags/aggregate";
import { applyTags, allInputs, tagContext } from "@/lib/tags/content";
import { kindMeta } from "@/lib/tags/types";
import { applyVariant } from "@/lib/variants";
import { documentFormData } from "@/lib/import/pdf-pages";
import { MAX_FILE_BYTES, type ImportResponse } from "@/lib/import/types";
import { RESUME_LIST_KEYS } from "@/types/schema";
import { SECTION_LABEL } from "@/lib/sections";
import { deleteJob, muteProposal, setProposalStatus, unmuteProposal, saveCaps } from "@/app/actions/job-actions";
import { Button, Textarea } from "@/components/ui/form-controls";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProposalCards } from "@/components/ui/proposal-cards";
import { ScoreRing } from "@/components/ui/job-context-panel";
import { Segmented } from "@/components/ui/insights-view";
import { useResumePageCount } from "@/components/ui/use-page-count";

const Charts = dynamic(() => import("@/components/ui/tag-charts").then(m => ({ default: ChartsBundle(m) })), {
    ssr: false,
    loading: () => <div className="h-56 flex items-center justify-center text-black/30 text-xs font-black uppercase tracking-widest">Loading charts…</div>,
});

type ChartModule = typeof import("@/components/ui/tag-charts");

function ChartsBundle(m: ChartModule) {
    return function JobCharts({ job, resume }: { job: JobRecord; resume: ResumeData }) {
        const jobTotals = jobKindTotals(job.requirements);
        const you = kindTotals(aggregateTags(resume, { selectedOnly: true }));
        const jobWeights = job.requirements.map(r => ({ ...r, weight: r.importance === "must" ? 2 : 1, items: [] }));
        return (
            <div className="grid gap-6 md:grid-cols-2">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">Shape: job vs you</p>
                    <m.KindRadar series={[{ label: "Job", totals: jobTotals, color: "#dc2626" }, { label: "You", totals: you, color: "#5d5294" }]} height={240} />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">What the job asks for</p>
                    <m.TopTagsBars weights={jobWeights} limit={12} height={240} />
                </div>
            </div>
        );
    };
}

export interface ExternalResume {
    fileName: string;
    data: ResumeData;
}

interface JobMatchViewProps {
    jobs: JobRecord[];
    preferences: Preferences;
    aliases: AliasMap;
    variants: ResumeVariant[];
    /** Working selection (draft-aware). */
    resumeData: ResumeData;
    activeJobId: string | null;
    selectedJobId: string | null;
    onSelectJob: (id: string | null) => void;
    onTailor: (id: string | null) => void;
    onApplyProposal: (job: JobRecord, p: Proposal) => Promise<void>;
    onImportExternal: (r: ExternalResume) => void;
    externalResume: ExternalResume | null;
    onExternalResume: (r: ExternalResume | null) => void;
}

export function JobMatchView(props: JobMatchViewProps) {
    const { jobs, selectedJobId, onSelectJob } = props;
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [pendingDelete, setPendingDelete] = useState<JobRecord | null>(null);
    const [deleting, setDeleting] = useState(false);
    const selected = jobs.find(j => j.id === selectedJobId) ?? null;

    return (
        <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
            <aside className="space-y-6">
                <AnalyzeForm resumeData={props.resumeData} onAnalyzed={(job) => { onSelectJob(job.id); router.refresh(); }} onError={setError} />
                <div className="space-y-2">
                    <h3 className="font-black text-gray-900 uppercase text-[11px] tracking-[0.3em] opacity-30 px-2">Analysed jobs</h3>
                    {jobs.length === 0 && <p className="px-2 text-sm text-black/40 font-medium">Nothing analysed yet.</p>}
                    <ul className="space-y-2">
                        {jobs.map(j => (
                            <li key={j.id}>
                                <button
                                    type="button"
                                    onClick={() => onSelectJob(j.id)}
                                    className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${j.id === selectedJobId ? "border-black bg-white shadow-lg shadow-black/5" : "border-black/5 bg-white hover:border-black/30"}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="font-black leading-tight truncate">{j.title}</p>
                                            <p className="text-xs text-black/50 font-bold truncate">{j.company || "Unknown company"}{props.activeJobId === j.id ? " · tailoring" : ""}</p>
                                        </div>
                                        {j.lastScore !== null && <span className="text-sm font-black text-black/60">{j.lastScore}</span>}
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </aside>

            <section className="min-w-0 space-y-6">
                {error && <div role="alert" className="border-2 border-red-200 bg-red-50 rounded-2xl p-4 text-red-800 text-sm font-bold">{error}</div>}
                {selected ? (
                    <JobDetail key={selected.id} job={selected} {...props} onDelete={() => setPendingDelete(selected)} onError={setError} />
                ) : (
                    <div className="p-12 border-2 border-dashed border-black/5 rounded-[2.5rem] text-center bg-gray-50/50">
                        <p className="text-black/40 font-bold text-xl tracking-tight">Pick a job or analyse a new one.</p>
                        <p className="text-black/30 text-sm mt-1">Paste a job description on the left. We extract its requirements and score your resume against them.</p>
                    </div>
                )}
            </section>

            <ConfirmDialog
                open={pendingDelete !== null}
                title={`Delete "${pendingDelete?.title}"?`}
                confirmLabel="Delete"
                danger
                busy={deleting}
                onCancel={() => setPendingDelete(null)}
                onConfirm={async () => {
                    if (!pendingDelete) return;
                    setDeleting(true);
                    try {
                        await deleteJob(pendingDelete.id);
                        if (props.activeJobId === pendingDelete.id) props.onTailor(null);
                        if (selectedJobId === pendingDelete.id) onSelectJob(null);
                        setPendingDelete(null);
                        router.refresh();
                    } catch (err) {
                        setError(err instanceof Error ? err.message : "Could not delete the job.");
                    } finally {
                        setDeleting(false);
                    }
                }}
            >
                <p>The analysis and its suggestions are removed. Your library is not affected.</p>
            </ConfirmDialog>
        </div>
    );
}

// ---------- Analyse form

const ACCEPT = ".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp";

function AnalyzeForm({ resumeData, onAnalyzed, onError }: { resumeData: ResumeData; onAnalyzed: (job: JobRecord) => void; onError: (e: string | null) => void }) {
    const [text, setText] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    const submit = async () => {
        onError(null);
        try {
            let body: FormData;
            if (text.trim()) {
                body = new FormData();
                body.set("text", text);
            } else if (file) {
                setBusy("Preparing file…");
                body = await documentFormData(file);
            } else return;
            // The working selection rides along so the server can reconcile the requirements
            // against the whole library (semantic matches: degree levels, implied skills, fields).
            body.set("resume", JSON.stringify(resumeData));
            setBusy("Extracting requirements & matching…");
            const res = await fetch("/api/jobs/analyze", { method: "POST", body });
            const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string; job?: JobRecord; warning?: string } | null;
            if (!json) throw new Error(`Analysis failed (${res.status}).`);
            if (!json.ok || !json.job) throw new Error(json.error ?? "Analysis failed.");
            setText("");
            setFile(null);
            if (json.warning) onError(`${json.warning} Exact keyword matching is shown; use "Re-check with AI" to retry.`);
            onAnalyzed(json.job);
        } catch (err) {
            onError(err instanceof Error ? err.message : "Analysis failed.");
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="bg-white border-2 border-black/5 rounded-[2rem] p-5 shadow-sm space-y-3">
            <h3 className="font-black text-gray-900 uppercase text-[11px] tracking-[0.3em] opacity-40">Analyse a job</h3>
            <Textarea value={text} onChange={e => setText(e.target.value)} rows={7} placeholder="Paste the job description here…" disabled={busy !== null} />
            <div className="flex items-center gap-3 text-xs font-bold text-black/40">
                <span className="h-px flex-1 bg-black/5" />or upload<span className="h-px flex-1 bg-black/5" />
            </div>
            <label className={`block cursor-pointer rounded-2xl border-2 border-dashed p-4 text-center text-sm font-bold ${file ? "border-black/30 text-black" : "border-black/10 text-black/40 hover:border-black/40"}`}>
                <input
                    type="file"
                    accept={ACCEPT}
                    className="sr-only"
                    disabled={busy !== null}
                    onChange={e => {
                        const f = e.target.files?.[0] ?? null;
                        if (f && f.size > MAX_FILE_BYTES) { onError("That file is over 10 MB."); return; }
                        setFile(f);
                        e.target.value = "";
                    }}
                />
                {file ? file.name : "PDF · DOCX · TXT · image"}
            </label>
            <Button variant="primary" className="w-full" onClick={submit} disabled={!text.trim() && !file} loading={busy !== null}>
                {busy ?? "Analyse"}
            </Button>
        </div>
    );
}

// ---------- Job detail

type DetailProps = JobMatchViewProps & { job: JobRecord; onDelete: () => void; onError: (e: string | null) => void };

function JobDetail({ job, preferences, aliases, variants, resumeData, activeJobId, onTailor, onApplyProposal, onImportExternal, externalResume, onExternalResume, onDelete, onError }: DetailProps) {
    const router = useRouter();
    const [source, setSource] = useState<ResumeSource>(externalResume ? { kind: "upload", fileName: externalResume.fileName } : { kind: "selection" });
    const [proposals, setProposals] = useState<Proposal[]>(job.proposals);
    const [muted, setMuted] = useState<MuteRule[]>(preferences.mutedProposals);
    const [caps, setCaps] = useState(preferences.caps);
    const [busy, setBusy] = useState<string | null>(null);
    const [uploading, setUploading] = useState<string | null>(null);
    const [showAts, setShowAts] = useState(true);
    const [showCaps, setShowCaps] = useState(false);

    const variant = source.kind === "variant" ? variants.find(v => v.id === source.variantId) ?? null : null;
    const resume: ResumeData =
        source.kind === "upload" && externalResume ? externalResume.data
        : variant ? applyVariant(resumeData, variant.items)
        : resumeData;
    const match = scoreJob(job.requirements, resume, aliases);
    const pages = useResumePageCount(resume);
    const reqDisplay = (name: string) => job.requirements.find(r => r.name === name)?.display ?? name;

    const uploadResume = async (file: File) => {
        onError(null);
        try {
            if (file.size > MAX_FILE_BYTES) throw new Error("That file is over 10 MB.");
            setUploading("Reading resume…");
            const res = await fetch("/api/import", { method: "POST", body: await documentFormData(file) });
            const json = (await res.json().catch(() => null)) as ImportResponse | null;
            if (!json) throw new Error(`Import failed (${res.status}).`);
            if (!json.ok) throw new Error(json.error);
            setUploading("Analysing skills…");
            const tagRes = await fetch("/api/tags/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: allInputs(json.data), context: tagContext(json.data) }) });
            const tagJson = (await tagRes.json().catch(() => null)) as { ok: boolean; error?: string; tagsById?: Record<string, ResumeData["profileTags"]> } | null;
            if (!tagJson?.ok) throw new Error(tagJson?.error ?? "Skill analysis failed.");
            const data = applyTags(json.data, tagJson.tagsById ?? {});
            onExternalResume({ fileName: json.fileName, data });
            setSource({ kind: "upload", fileName: json.fileName });
        } catch (err) {
            onError(err instanceof Error ? err.message : "Could not read that resume.");
        } finally {
            setUploading(null);
        }
    };

    /** Re-runs the broader-context pass against the resume being scored (any source). */
    const recheck = async () => {
        onError(null);
        setBusy("recheck");
        try {
            const res = await fetch("/api/jobs/reconcile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: job.id, resume }) });
            const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
            if (!json?.ok) throw new Error(json?.error ?? "The AI match check failed.");
            router.refresh();
        } catch (err) {
            onError(err instanceof Error ? err.message : "The AI match check failed.");
        } finally {
            setBusy(null);
        }
    };

    const getSuggestions = async () => {
        onError(null);
        setBusy("suggest");
        try {
            const res = await fetch("/api/jobs/proposals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: job.id, resume }) });
            const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string; proposals?: Proposal[] } | null;
            if (!json?.ok || !json.proposals) throw new Error(json?.error ?? "Could not get suggestions.");
            setProposals(json.proposals);
            router.refresh();
        } catch (err) {
            onError(err instanceof Error ? err.message : "Could not get suggestions.");
        } finally {
            setBusy(null);
        }
    };

    const setStatus = async (p: Proposal, status: Proposal["status"]) => {
        setProposals(prev => prev.map(x => (x.id === p.id ? { ...x, status } : x)));
        try {
            await setProposalStatus(job.id, p.id, status);
        } catch (err) {
            onError(err instanceof Error ? err.message : "Could not update the suggestion.");
        }
    };

    const apply = async (p: Proposal) => {
        if (source.kind === "upload") { onError("Suggestions can only be applied to your own library. Import the uploaded resume first."); return; }
        setBusy(p.id);
        try {
            await onApplyProposal(job, p);
            await setStatus(p, "applied");
        } catch (err) {
            onError(err instanceof Error ? err.message : "Could not apply the suggestion.");
        } finally {
            setBusy(null);
        }
    };

    const ignoreSimilar = async (p: Proposal) => {
        const rule = muteRuleFor(p);
        setMuted(prev => [...prev, rule]);
        await setStatus(p, "ignored");
        try { await muteProposal(rule); } catch (err) { onError(err instanceof Error ? err.message : "Could not save the rule."); }
    };

    const unmute = async (rule: MuteRule) => {
        setMuted(prev => prev.filter(r => !(r.kind === rule.kind && (r.tag ?? "") === (rule.tag ?? "") && (r.itemId ?? "") === (rule.itemId ?? ""))));
        try { await unmuteProposal(rule); } catch (err) { onError(err instanceof Error ? err.message : "Could not update the rule."); }
    };

    const tailoring = activeJobId === job.id;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white border-2 border-black/5 rounded-[2rem] p-6 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h2 className="text-2xl font-black tracking-tight leading-tight">{job.title}</h2>
                        <p className="text-black/50 font-bold">{job.company || "Unknown company"}{job.source.fileName ? ` · from ${job.source.fileName}` : ""}</p>
                        {job.summary && <p className="text-sm text-black/60 font-medium mt-2">{job.summary}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                        <Button size="sm" variant={tailoring ? "default" : "primary"} onClick={() => onTailor(tailoring ? null : job.id)}>
                            {tailoring ? "Stop tailoring" : "Tailor for this job"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={onDelete} className="hover:!text-red-600 hover:!bg-red-50">Delete</Button>
                    </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {job.requirements.map(r => (
                        <span key={r.name} className={`px-2 py-1 rounded-md text-[11px] font-bold border ${r.importance === "must" ? "border-black/20 bg-white" : "border-transparent bg-gray-100 text-black/60"}`} style={{ color: kindMeta(r.kind).color }} title={`${r.importance === "must" ? "Must-have" : "Nice-to-have"} · ${kindMeta(r.kind).label}${r.yearsMin ? ` · ${r.yearsMin}+ years` : ""}`}>
                            {r.display}{r.yearsMin ? <span className="text-black/40"> {r.yearsMin}y+</span> : null}
                        </span>
                    ))}
                </div>
            </div>

            {/* Source + score */}
            <div className="bg-white border-2 border-black/5 rounded-[2rem] p-6 shadow-sm space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <Segmented
                        value={source.kind}
                        onChange={(k) => {
                            if (k === "selection") setSource({ kind: "selection" });
                            else if (k === "variant") setSource({ kind: "variant", variantId: variants[0]?.id ?? "" });
                            else if (externalResume) setSource({ kind: "upload", fileName: externalResume.fileName });
                            else setSource({ kind: "upload", fileName: "" });
                        }}
                        options={[{ value: "selection", label: "Working selection" }, { value: "variant", label: "Variant" }, { value: "upload", label: "Uploaded resume" }]}
                    />
                    {source.kind === "variant" && (
                        <select
                            value={source.variantId}
                            onChange={e => setSource({ kind: "variant", variantId: e.target.value })}
                            className="px-4 py-2.5 rounded-xl border-2 border-black/10 focus:border-black outline-none text-sm font-bold bg-white"
                        >
                            {variants.length === 0 && <option value="">No variants saved yet</option>}
                            {variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                    )}
                    {source.kind === "upload" && (
                        <div className="flex flex-wrap items-center gap-2">
                            <label className={`cursor-pointer px-4 py-2.5 rounded-xl border-2 border-black/10 hover:border-black text-[11px] font-black uppercase tracking-widest ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                                <input type="file" accept={ACCEPT} className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) uploadResume(f); e.target.value = ""; }} />
                                {uploading ?? (externalResume ? `Replace ${externalResume.fileName}` : "Upload a resume")}
                            </label>
                            {externalResume && (
                                <Button size="sm" onClick={() => onImportExternal(externalResume)}>Import into library</Button>
                            )}
                        </div>
                    )}
                </div>

                {source.kind === "upload" && !externalResume ? (
                    <p className="text-sm text-black/40 font-medium">Upload a resume to score it against this job. It is not saved unless you import it.</p>
                ) : (
                    <>
                        <div className="flex flex-col md:flex-row md:items-center gap-6">
                            <div className="text-black"><ScoreRing score={match.score} size={88} /></div>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm font-bold">
                                <span className="text-black/40">Must-haves</span><span>{match.must.hit}/{match.must.total} covered</span>
                                <span className="text-black/40">Nice-to-haves</span><span>{match.nice.hit}/{match.nice.total} covered</span>
                                <span className="text-black/40">Length</span>
                                <span className={pages !== null && pages > 1 ? "text-amber-600" : ""}>{pages === null ? "…" : `${pages} ${pages === 1 ? "page" : "pages"}${pages > 1 ? " — over one page" : ""}`}</span>
                            </div>
                            <div className="md:ml-auto text-sm space-y-2 md:text-right">
                                {match.missingMust.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-red-600/70">Missing must-haves</p>
                                        <p className="font-bold text-red-700">{match.missingMust.map(r => r.display).join(", ")}</p>
                                    </div>
                                )}
                                {match.keywordGaps.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-600/80">Add these keywords before applying</p>
                                        <p className="font-bold text-amber-700">{match.keywordGaps.map(r => r.display).join(", ")}</p>
                                    </div>
                                )}
                                <Button size="sm" onClick={recheck} loading={busy === "recheck"} title="Ask the AI to match requirements against your whole library: equivalent degrees, implied skills, related projects.">
                                    Re-check with AI
                                </Button>
                            </div>
                        </div>
                        <Charts job={job} resume={resume} />
                    </>
                )}
            </div>

            {/* ATS table */}
            <div className="bg-white border-2 border-black/5 rounded-[2rem] p-6 shadow-sm space-y-3">
                <button type="button" onClick={() => setShowAts(v => !v)} className="flex items-center justify-between w-full">
                    <h3 className="font-black text-gray-900 uppercase text-[11px] tracking-[0.3em] opacity-40">ATS keyword check</h3>
                    <span className="text-[10px] font-black uppercase tracking-widest text-black/30">{showAts ? "Hide" : "Show"}</span>
                </button>
                {showAts && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[10px] font-black uppercase tracking-widest text-black/40 border-b border-black/5">
                                    <th className="px-3 py-2">Requirement</th>
                                    <th className="px-3 py-2">Priority</th>
                                    <th className="px-3 py-2">In your tags</th>
                                    <th className="px-3 py-2">Printed on resume</th>
                                    <th className="px-3 py-2">Where</th>
                                </tr>
                            </thead>
                            <tbody>
                                {match.rows.map(r => (
                                    <tr key={r.requirement.name} className={`border-b border-black/5 align-top ${r.strength === 0 ? "bg-red-50/40" : ""}`}>
                                        <td className="px-3 py-2 font-bold whitespace-nowrap">{r.requirement.display}</td>
                                        <td className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-black/40 whitespace-nowrap">
                                            {r.requirement.importance === "must" ? "Must" : "Nice"}
                                            <span className="text-black/25" title={r.tier === "hard" ? "Hard skill: missing it counts fully against the score." : "Soft skill or practice: missing it is keyword advice, weighted 0.3."}> · {r.tier}</span>
                                        </td>
                                        <td className="px-3 py-2" title={r.reason || undefined}>
                                            {r.tagHit ? <span className="text-emerald-700 font-bold">Yes · {r.weight}</span> : <span className="text-black/30">No</span>}
                                            {r.via.length > 0 && <span className="block text-[11px] text-black/50 font-medium">via {r.via.slice(0, 3).join(", ")}{r.via.length > 3 ? ` +${r.via.length - 3}` : ""}</span>}
                                            {r.via.length === 0 && r.reason && <span className="block text-[11px] text-black/50 font-medium">inferred from your items</span>}
                                        </td>
                                        <td className="px-3 py-2">{r.literalHit ? <span className="text-emerald-700 font-bold">Yes</span> : <span className={r.tagHit ? "text-amber-600 font-bold" : "text-black/30"}>{r.tagHit ? "Not literally" : "No"}</span>}</td>
                                        <td className="px-3 py-2 text-black/50 text-xs">{r.items.map(i => i.label).slice(0, 3).join(" · ")}{r.items.length > 3 ? ` +${r.items.length - 3}` : ""}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Suggestions */}
            <div className="bg-white border-2 border-black/5 rounded-[2rem] p-6 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                        <h3 className="font-black text-gray-900 uppercase text-[11px] tracking-[0.3em] opacity-40">Suggestions</h3>
                        <p className="text-xs text-black/40 font-medium">Include/exclude picks come from keyword coverage under your section limits; rewrites and gaps from the AI coach.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => setShowCaps(v => !v)}>Section limits</Button>
                        <Button size="sm" variant="primary" onClick={getSuggestions} loading={busy === "suggest"} disabled={source.kind === "upload"}>
                            {proposals.length ? "Refresh suggestions" : "Get suggestions"}
                        </Button>
                    </div>
                </div>
                {showCaps && (
                    <CapsEditor caps={caps} onChange={setCaps} onSave={async () => { try { await saveCaps(caps); router.refresh(); } catch (err) { onError(err instanceof Error ? err.message : "Could not save limits."); } }} />
                )}
                {source.kind === "upload" && <p className="text-sm text-amber-700 font-bold">Suggestions work on your own library. Import the uploaded resume to get them.</p>}
                <ProposalCards
                    proposals={proposals}
                    requirementDisplay={reqDisplay}
                    busyId={busy && busy !== "suggest" ? busy : null}
                    onApply={apply}
                    onSkip={p => setStatus(p, "skipped")}
                    onIgnoreSimilar={ignoreSimilar}
                    onReopen={p => setStatus(p, "open")}
                    muted={muted}
                    onUnmute={unmute}
                />
            </div>
        </div>
    );
}

function CapsEditor({ caps, onChange, onSave }: { caps: Preferences["caps"]; onChange: (c: Preferences["caps"]) => void; onSave: () => Promise<void> }) {
    const [saving, setSaving] = useState(false);
    return (
        <div className="rounded-2xl bg-gray-50 border border-black/5 p-4 space-y-3">
            <p className="text-xs text-black/50 font-medium">Maximum items per section in a recommended selection. Leave empty for no limit.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {RESUME_LIST_KEYS.map(key => (
                    <label key={key} className="text-[10px] font-black uppercase tracking-widest text-black/40">
                        {SECTION_LABEL[key]}
                        <input
                            type="number"
                            min={0}
                            value={caps[key] ?? ""}
                            placeholder="∞"
                            onChange={e => onChange({ ...caps, [key]: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
                            className="mt-1 w-full px-3 py-2 rounded-lg border-2 border-black/10 focus:border-black outline-none text-sm font-bold text-black normal-case tracking-normal bg-white"
                        />
                    </label>
                ))}
            </div>
            <Button size="sm" variant="primary" loading={saving} onClick={async () => { setSaving(true); try { await onSave(); } finally { setSaving(false); } }}>Save limits</Button>
        </div>
    );
}

export type { Requirement };
