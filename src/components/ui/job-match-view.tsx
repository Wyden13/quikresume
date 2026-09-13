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
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/primitives/button";
import { Input, Select, Textarea } from "@/components/ui/primitives/field";
import { ConfirmDialog } from "@/components/ui/primitives/dialog";
import { ProposalCards } from "@/components/ui/proposal-cards";
import { ScoreRing } from "@/components/ui/primitives/score-ring";
import { Segmented } from "@/components/ui/primitives/segmented";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives/card";
import { Badge } from "@/components/ui/primitives/badge";
import { NoticeBanner } from "@/components/ui/primitives/notice-banner";
import { EmptyState } from "@/components/ui/primitives/empty-state";
import { Table, Td, Th } from "@/components/ui/primitives/table";
import { ChevronDown, Target } from "@/components/ui/primitives/icons";
import { useResumePageCount } from "@/components/ui/use-page-count";

const Charts = dynamic(() => import("@/components/ui/tag-charts").then(m => ({ default: ChartsBundle(m) })), {
    ssr: false,
    loading: () => <div className="flex h-56 items-center justify-center text-13 text-fg-subtle">Loading charts…</div>,
});

type ChartModule = typeof import("@/components/ui/tag-charts");

function ChartsBundle(m: ChartModule) {
    return function JobCharts({ job, resume }: { job: JobRecord; resume: ResumeData }) {
        const jobTotals = jobKindTotals(job.requirements);
        const you = kindTotals(aggregateTags(resume, { selectedOnly: true }));
        const jobWeights = job.requirements.map(r => ({ ...r, weight: r.importance === "must" ? 2 : 1, items: [] }));
        return (
            <div className="grid gap-6 @2xl:grid-cols-2">
                <div>
                    <p className="mb-1 text-13 font-medium text-fg-muted">Shape: job vs you</p>
                    <m.KindRadar series={[{ label: "Job", totals: jobTotals, color: "#a3a3a3" }, { label: "You", totals: you, color: "#171717" }]} height={240} />
                </div>
                <div>
                    <p className="mb-1 text-13 font-medium text-fg-muted">What the job asks for</p>
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
        // Container queries, not viewport breakpoints: the width left over depends on the sidebar and the resizable preview pane.
        <div className="@container">
            <div className="grid gap-6 @4xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
                <aside className="min-w-0 space-y-4">
                    <AnalyzeForm resumeData={props.resumeData} onAnalyzed={(job) => { onSelectJob(job.id); router.refresh(); }} onError={setError} />
                    {jobs.length > 0 && (
                        <>
                            <div className="@4xl:hidden">
                                <Select value={selectedJobId ?? ""} onChange={e => onSelectJob(e.target.value || null)} aria-label="Analysed jobs">
                                    <option value="">Pick an analysed job…</option>
                                    {jobs.map(j => <option key={j.id} value={j.id}>{j.title}{j.company ? ` · ${j.company}` : ""}</option>)}
                                </Select>
                            </div>
                            <div className="hidden @4xl:block">
                                <p className="mb-2 px-1 text-13 font-medium text-fg-muted">Analysed jobs</p>
                                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
                                    {jobs.map(j => {
                                        const active = j.id === selectedJobId;
                                        return (
                                            <li key={j.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => onSelectJob(j.id)}
                                                    aria-current={active || undefined}
                                                    className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover", active && "bg-surface-muted")}
                                                >
                                                    <span className={cn("h-8 w-0.5 shrink-0 rounded-full", active ? "bg-accent" : "bg-transparent")} aria-hidden />
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate text-sm font-medium text-fg">{j.title}</span>
                                                        <span className="block truncate text-xs text-fg-muted">{j.company || "Unknown company"}{props.activeJobId === j.id ? " · tailoring" : ""}</span>
                                                    </span>
                                                    {j.lastScore !== null && <span className="text-13 tabular-nums text-fg-muted">{j.lastScore}</span>}
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        </>
                    )}
                </aside>

                <section className="@container min-w-0 space-y-4">
                    {error && <NoticeBanner tone="danger" onDismiss={() => setError(null)}>{error}</NoticeBanner>}
                    {selected ? (
                        <JobDetail key={selected.id} job={selected} {...props} onDelete={() => setPendingDelete(selected)} onError={setError} />
                    ) : (
                        <EmptyState icon={Target} title="Pick a job or analyse a new one" body="Paste a job description on the left. We extract its requirements and score your résumé against them." />
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
        <Card>
            <CardHeader title="Analyse a job" />
            <CardBody className="space-y-3">
                <Textarea value={text} onChange={e => setText(e.target.value)} rows={7} placeholder="Paste the job description here…" disabled={busy !== null} />
                <div className="flex items-center gap-3 text-xs text-fg-subtle">
                    <span className="h-px flex-1 bg-border" />or upload<span className="h-px flex-1 bg-border" />
                </div>
                <label className={cn("block cursor-pointer rounded-md border border-dashed px-3 py-2.5 text-center text-13 transition-colors", file ? "border-border-strong text-fg" : "border-border-strong text-fg-muted hover:border-fg-subtle")}>
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
            </CardBody>
        </Card>
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
        : variant ? applyVariant(resumeData, variant.items, variant.hidden)
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
        <div className="space-y-4">
            {/* Header */}
            <Card>
                <CardHeader
                    title={job.title}
                    hint={<>{job.company || "Unknown company"}{job.source.fileName ? ` · from ${job.source.fileName}` : ""}</>}
                    action={
                        <>
                            <Button size="sm" variant={tailoring ? "secondary" : "primary"} onClick={() => onTailor(tailoring ? null : job.id)}>
                                {tailoring ? "Stop tailoring" : "Tailor for this job"}
                            </Button>
                            <Button size="sm" variant="danger" onClick={onDelete}>Delete</Button>
                        </>
                    }
                />
                <CardBody className="space-y-3">
                    {job.summary && <p className="text-13 text-fg-muted">{job.summary}</p>}
                    <div className="flex flex-wrap gap-1">
                        {job.requirements.map(r => (
                            <Badge
                                key={r.name}
                                tone={r.importance === "must" ? "strong" : "neutral"}
                                title={`${r.importance === "must" ? "Must-have" : "Nice-to-have"} · ${kindMeta(r.kind).label}${r.yearsMin ? ` · ${r.yearsMin}+ years` : ""}`}
                            >
                                {r.display}{r.yearsMin ? <span className="ml-1 opacity-60">{r.yearsMin}y+</span> : null}
                            </Badge>
                        ))}
                    </div>
                </CardBody>
            </Card>

            {/* Source + score */}
            <Card>
                <CardBody className="space-y-5 pt-4">
                    <div className="flex flex-col gap-3 @2xl:flex-row @2xl:items-center @2xl:justify-between">
                        <Segmented
                            value={source.kind}
                            onChange={(k) => {
                                if (k === "selection") setSource({ kind: "selection" });
                                else if (k === "variant") setSource({ kind: "variant", variantId: variants[0]?.id ?? "" });
                                else if (externalResume) setSource({ kind: "upload", fileName: externalResume.fileName });
                                else setSource({ kind: "upload", fileName: "" });
                            }}
                            options={[{ value: "selection", label: "Working selection" }, { value: "variant", label: "Variant" }, { value: "upload", label: "Uploaded résumé" }]}
                        />
                        {source.kind === "variant" && (
                            <Select value={source.variantId} onChange={e => setSource({ kind: "variant", variantId: e.target.value })} className="@2xl:w-56" aria-label="Variant">
                                {variants.length === 0 && <option value="">No variants saved yet</option>}
                                {variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </Select>
                        )}
                        {source.kind === "upload" && (
                            <div className="flex flex-wrap items-center gap-2">
                                <label className={cn("inline-flex h-8 cursor-pointer items-center rounded-md border border-border bg-surface px-2.5 text-13 font-medium hover:bg-surface-hover", uploading && "pointer-events-none opacity-50")}>
                                    <input type="file" accept={ACCEPT} className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) uploadResume(f); e.target.value = ""; }} />
                                    {uploading ?? (externalResume ? `Replace ${externalResume.fileName}` : "Upload a résumé")}
                                </label>
                                {externalResume && <Button size="sm" onClick={() => onImportExternal(externalResume)}>Import into library</Button>}
                            </div>
                        )}
                    </div>

                    {source.kind === "upload" && !externalResume ? (
                        <p className="text-13 text-fg-muted">Upload a résumé to score it against this job. It is not saved unless you import it.</p>
                    ) : (
                        <>
                            <div className="flex flex-col gap-5 @2xl:flex-row @2xl:items-center">
                                <ScoreRing score={match.score} size={80} />
                                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-13">
                                    <dt className="text-fg-subtle">Must-haves</dt><dd className="tabular-nums">{match.must.hit}/{match.must.total} covered</dd>
                                    <dt className="text-fg-subtle">Nice-to-haves</dt><dd className="tabular-nums">{match.nice.hit}/{match.nice.total} covered</dd>
                                    <dt className="text-fg-subtle">Length</dt>
                                    <dd className={cn("tabular-nums", pages !== null && pages > 1 && "text-warning")}>{pages === null ? "…" : `${pages} ${pages === 1 ? "page" : "pages"}${pages > 1 ? " · over one page" : ""}`}</dd>
                                </dl>
                                <div className="min-w-0 space-y-2 text-13 @2xl:ml-auto @2xl:max-w-[50%] @2xl:text-right">
                                    {match.missingMust.length > 0 && (
                                        <div>
                                            <p className="text-xs text-fg-subtle">Missing must-haves</p>
                                            <p className="font-medium text-danger">{match.missingMust.map(r => r.display).join(", ")}</p>
                                        </div>
                                    )}
                                    {match.keywordGaps.length > 0 && (
                                        <div>
                                            <p className="text-xs text-fg-subtle">Add these keywords before applying</p>
                                            <p className="font-medium text-warning">{match.keywordGaps.map(r => r.display).join(", ")}</p>
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
                </CardBody>
            </Card>

            {/* ATS table */}
            <Card>
                <CardHeader
                    title="ATS keyword check"
                    action={<Button size="sm" variant="ghost" onClick={() => setShowAts(v => !v)} aria-expanded={showAts}>{showAts ? "Hide" : "Show"}<ChevronDown className={cn("size-3.5 transition-transform", showAts && "rotate-180")} /></Button>}
                />
                {showAts && (
                    <Table>
                        <thead>
                            <tr>
                                <Th>Requirement</Th>
                                <Th>Priority</Th>
                                <Th>In your tags</Th>
                                <Th>Printed on résumé</Th>
                                <Th className="min-w-56">Where</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {match.rows.map(r => (
                                <tr key={r.requirement.name}>
                                    <Td className={cn("whitespace-nowrap font-medium", r.strength === 0 ? "text-danger" : "text-fg")}>{r.requirement.display}</Td>
                                    <Td className="whitespace-nowrap text-fg-muted">
                                        {r.requirement.importance === "must" ? "Must" : "Nice"}
                                        <span className="text-fg-subtle" title={r.tier === "hard" ? "Hard skill: missing it counts fully against the score." : "Soft skill or practice: missing it is keyword advice, weighted 0.3."}> · {r.tier}</span>
                                    </Td>
                                    <Td title={r.reason || undefined}>
                                        {r.tagHit ? <span className="font-medium text-success">Yes · {r.weight}</span> : <span className="text-fg-subtle">No</span>}
                                        {r.via.length > 0 && <span className="block text-xs text-fg-muted">via {r.via.slice(0, 3).join(", ")}{r.via.length > 3 ? ` +${r.via.length - 3}` : ""}</span>}
                                        {r.via.length === 0 && r.reason && <span className="block text-xs text-fg-muted">inferred from your items</span>}
                                    </Td>
                                    <Td>{r.literalHit ? <span className="font-medium text-success">Yes</span> : <span className={r.tagHit ? "font-medium text-warning" : "text-fg-subtle"}>{r.tagHit ? "Not literally" : "No"}</span>}</Td>
                                    <Td className="min-w-56 text-xs leading-relaxed text-fg-muted">{r.items.map(i => i.label).slice(0, 3).join(" · ")}{r.items.length > 3 ? ` +${r.items.length - 3}` : ""}</Td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                )}
            </Card>

            {/* Suggestions */}
            <Card>
                <CardHeader
                    title="Suggestions"
                    hint="Include/exclude picks come from keyword coverage under your section limits; rewrites and gaps from the AI coach."
                    action={
                        <>
                            <Button size="sm" variant="ghost" onClick={() => setShowCaps(v => !v)} aria-expanded={showCaps}>Section limits</Button>
                            <Button size="sm" variant="primary" onClick={getSuggestions} loading={busy === "suggest"} disabled={source.kind === "upload"}>
                                {proposals.length ? "Refresh" : "Get suggestions"}
                            </Button>
                        </>
                    }
                />
                <CardBody className="space-y-3">
                    {showCaps && (
                        <CapsEditor caps={caps} onChange={setCaps} onSave={async () => { try { await saveCaps(caps); router.refresh(); } catch (err) { onError(err instanceof Error ? err.message : "Could not save limits."); } }} />
                    )}
                    {source.kind === "upload" && <p className="text-13 text-warning">Suggestions work on your own library. Import the uploaded résumé to get them.</p>}
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
                </CardBody>
            </Card>
        </div>
    );
}

function CapsEditor({ caps, onChange, onSave }: { caps: Preferences["caps"]; onChange: (c: Preferences["caps"]) => void; onSave: () => Promise<void> }) {
    const [saving, setSaving] = useState(false);
    return (
        <div className="space-y-3 rounded-md border border-border bg-surface-muted/50 p-3">
            <p className="text-13 text-fg-muted">Maximum items per section in a recommended selection. Leave empty for no limit.</p>
            <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-3">
                {RESUME_LIST_KEYS.map(key => (
                    <label key={key} className="text-xs text-fg-muted">
                        {SECTION_LABEL[key]}
                        <Input
                            type="number"
                            min={0}
                            value={caps[key] ?? ""}
                            placeholder="∞"
                            onChange={e => onChange({ ...caps, [key]: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
                            className="mt-1 h-8 text-13"
                        />
                    </label>
                ))}
            </div>
            <Button size="sm" variant="primary" loading={saving} onClick={async () => { setSaving(true); try { await onSave(); } finally { setSaving(false); } }}>Save limits</Button>
        </div>
    );
}

export type { Requirement };
