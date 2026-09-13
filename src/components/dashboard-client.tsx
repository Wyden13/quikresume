"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { ResumeData, ResumeListKey } from "@/types/schema";
import { RESUME_LIST_KEYS } from "@/types/schema";
import type {
    AwardItem, CertificationItem, EducationItem, ExperienceItem, LanguageItem, ProjectItem, PublicationItem,
    ResumeVariant, SkillCategoryItem, VolunteeringItem,
} from "@/types/db";
import type { JobRecord, Preferences, Proposal } from "@/lib/match/types";
import type { AliasMap } from "@/lib/tags/normalize";
import { ResumeForm } from "@/components/ui/resume-form";
import SelectionDisplay from "@/components/ui/selection-display";
import { ResumeImport } from "@/components/ui/resume-import";
import { InsightsView } from "@/components/ui/insights-view";
import { JobMatchView, type ExternalResume } from "@/components/ui/job-match-view";
import { JobContextPanel } from "@/components/ui/job-context-panel";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { VariantToolbar } from "@/components/ui/variant-toolbar";
import { saveResumeData } from "@/app/actions/resume-actions";
import { updateExperience } from "@/app/actions/experience-actions";
import { updateEducation } from "@/app/actions/education-actions";
import { updateSkill } from "@/app/actions/skill-actions";
import { updateProject } from "@/app/actions/project-actions";
import { updateCertification } from "@/app/actions/certification-actions";
import { updateAward } from "@/app/actions/award-actions";
import { updateVolunteering } from "@/app/actions/volunteering-actions";
import { updatePublication } from "@/app/actions/publication-actions";
import { updateLanguage } from "@/app/actions/language-actions";
import { mergeImport, type ImportSelection } from "@/lib/import/merge";
import { applyTags, contentHashOf, staleInputs, tagContext } from "@/lib/tags/content";
import { applyProposal } from "@/lib/match/proposals";
import { itemTitle } from "@/lib/sections";

// The preview compiles Typst in the browser (wasm), so it must never render on the server.
const ResumePreview = dynamic(
    () => import("@/components/ui/resume-preview").then(m => m.ResumePreview),
    {
        ssr: false,
        loading: () => (
            <div className="aspect-[210/297] w-full max-w-[210mm] mx-auto bg-white shadow-2xl flex items-center justify-center">
                <span className="text-black/30 font-bold uppercase tracking-widest text-xs">Loading preview…</span>
            </div>
        ),
    },
);

const UPDATE_ACTION: Record<ResumeListKey, (id: string, fd: FormData) => Promise<void>> = {
    workExperience: updateExperience,
    education: updateEducation,
    skills: updateSkill,
    projects: updateProject,
    certifications: updateCertification,
    awards: updateAward,
    volunteering: updateVolunteering,
    publications: updatePublication,
    languages: updateLanguage,
};

interface DashboardClientProps {
    /** Complete editor model built on the server (profile + all subcollections). */
    initialResumeData: ResumeData;
    experiences: ExperienceItem[];
    educations: EducationItem[];
    skills: SkillCategoryItem[];
    projects: ProjectItem[];
    certifications: CertificationItem[];
    awards: AwardItem[];
    volunteering: VolunteeringItem[];
    publications: PublicationItem[];
    languages: LanguageItem[];
    variants: ResumeVariant[];
    variantUsage: Record<string, string[]>;
    loadedVariantId: string | null;
    jobs: JobRecord[];
    preferences: Preferences;
    tagAliases: AliasMap;
    userName: string;
}

type View = "library" | "edit" | "preview" | "import" | "insights" | "jobs";
type Notice = { tone: "ok" | "warn"; text: string };

const TAILOR_KEY = "quikresume.activeJobId";

export default function DashboardClient({
    initialResumeData,
    experiences,
    educations,
    skills,
    projects,
    certifications,
    awards,
    volunteering,
    publications,
    languages,
    variants,
    variantUsage,
    loadedVariantId,
    jobs,
    preferences,
    tagAliases,
    userName,
}: DashboardClientProps) {
    const router = useRouter();
    const [view, setView] = useState<View>("library");
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [notice, setNotice] = useState<Notice | null>(null);
    const [confirmVariants, setConfirmVariants] = useState<string[] | null>(null);
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    const [reanalyzing, setReanalyzing] = useState(false);

    // Job Match state
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [externalResume, setExternalResume] = useState<ExternalResume | null>(null);

    // Draft model: `draft` is null unless the editor is open. Everything else
    // reads server truth from props, which Next refreshes after each server
    // action (revalidatePath). Because the draft is never re-derived from
    // props, a revalidation can't clobber unsaved edits.
    const [draft, setDraft] = useState<ResumeData | null>(null);
    const resumeData = draft ?? initialResumeData;

    // Tailoring mode survives a reload (browser-only state, read once after mount).
    useEffect(() => {
        try {
            const stored = window.sessionStorage.getItem(TAILOR_KEY);
            if (stored && jobs.some(j => j.id === stored)) setActiveJobId(stored);
        } catch { /* storage unavailable */ }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const setTailoring = (id: string | null) => {
        setActiveJobId(id);
        try {
            if (id) window.sessionStorage.setItem(TAILOR_KEY, id);
            else window.sessionStorage.removeItem(TAILOR_KEY);
        } catch { /* ignore */ }
    };
    const activeJob = activeJobId ? jobs.find(j => j.id === activeJobId) ?? null : null;

    const updateDraft = (updater: (prev: ResumeData) => ResumeData) => {
        setDraft(prev => updater(prev ?? initialResumeData));
    };

    const openEditor = () => {
        // Keep an in-progress draft (e.g. one seeded by an import) if there is one.
        setDraft(prev => prev ?? initialResumeData);
        setSaveError(null);
        setView("edit");
    };

    const doDiscard = () => {
        setConfirmDiscard(false);
        setDraft(null);
        setSaveError(null);
        setNotice(null);
        setView("library");
    };
    const discardDraft = () => {
        const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(initialResumeData);
        if (dirty) setConfirmDiscard(true);
        else doDiscard();
    };

    /** Ids of persisted items whose content changed in the draft. */
    const changedItemIds = (): string[] => {
        if (!draft) return [];
        const out: string[] = [];
        for (const key of RESUME_LIST_KEYS) {
            const before = new Map((initialResumeData[key] as ResumeData[ResumeListKey][number][]).map(it => [it.id, it]));
            for (const item of draft[key] as ResumeData[ResumeListKey][number][]) {
                const prev = before.get(item.id);
                if (prev && contentHashOf(key, prev) !== contentHashOf(key, item)) out.push(item.id);
            }
        }
        return out;
    };

    const doSave = async () => {
        if (!draft) return;
        setConfirmVariants(null);
        setIsSaving(true);
        setSaveError(null);
        try {
            const result = await saveResumeData(draft);
            if (result.success) {
                setDraft(null);
                setNotice(result.tagWarning
                    ? { tone: "warn", text: `Saved. Skill analysis did not finish: ${result.tagWarning}` }
                    : result.tagged > 0
                        ? { tone: "ok", text: `Saved. Analysed skills for ${result.tagged} ${result.tagged === 1 ? "item" : "items"}.` }
                        : null);
                setView("library");
            }
        } catch (error) {
            console.error("Failed to save:", error);
            setSaveError(error instanceof Error ? error.message : "Failed to save your library changes.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveAndExit = () => {
        if (!draft) { setView("library"); return; }
        const affected = [...new Set(changedItemIds().flatMap(id => variantUsage[id] ?? []))];
        if (affected.length > 0) { setConfirmVariants(affected); return; }
        void doSave();
    };

    const handleImport = (selection: ImportSelection, meta: { fileNames: string[] }) => {
        const merged = mergeImport(draft ?? initialResumeData, selection);
        setDraft(merged.data);
        const src = meta.fileNames.length === 1 ? meta.fileNames[0] : `${meta.fileNames.length} files`;
        const parts = [`Imported ${merged.added} new ${merged.added === 1 ? "item" : "items"} from ${src}.`];
        if (merged.updated > 0) parts.push(`${merged.updated} existing ${merged.updated === 1 ? "item gained" : "items gained"} detail.`);
        if (merged.unchanged > 0) parts.push(`${merged.unchanged} already in your library ${merged.unchanged === 1 ? "was" : "were"} skipped.`);
        parts.push("Review below, then Save & Exit to keep them.");
        setNotice({ tone: "ok", text: parts.join(" ") });
        setSaveError(null);
        setView("edit");
    };

    /** Tags stale draft items in place (nothing saved) or, with no draft open, backfills the library. */
    const reanalyze = async () => {
        setReanalyzing(true);
        try {
            if (draft) {
                const res = await fetch("/api/tags/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: staleInputs(draft), context: tagContext(draft) }) });
                const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string; tagsById?: Record<string, ResumeData["profileTags"]> } | null;
                if (!json?.ok) throw new Error(json?.error ?? "Skill analysis failed.");
                setDraft(prev => (prev ? applyTags(prev, json.tagsById ?? {}) : prev));
            } else {
                const res = await fetch("/api/tags/backfill", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
                const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
                if (!json?.ok) throw new Error(json?.error ?? "Skill analysis failed.");
                router.refresh();
            }
        } catch (err) {
            setNotice({ tone: "warn", text: err instanceof Error ? err.message : "Skill analysis failed." });
        } finally {
            setReanalyzing(false);
        }
    };

    /** Applies a Job Match proposal: selection changes go to the server unless a draft is open; text edits open the editor. */
    const handleApplyProposal = async (job: JobRecord, p: Proposal) => {
        if (!p.section || !p.itemId) return;
        if (p.kind === "include" || p.kind === "exclude") {
            if (draft) {
                updateDraft(prev => applyProposal(prev, p));
            } else {
                const fd = new FormData();
                fd.set("isSelected", String(p.kind === "include"));
                await UPDATE_ACTION[p.section](p.itemId, fd);
                router.refresh();
            }
            return;
        }
        const next = applyProposal(draft ?? initialResumeData, p);
        setDraft(next);
        const item = (next[p.section] as ResumeData[ResumeListKey][number][]).find(it => it.id === p.itemId);
        setNotice({ tone: "ok", text: `Applied the suggestion to ${item ? itemTitle(p.section, item) : "an item"} for ${job.title}. Review it below, then Save & Exit.` });
        setTailoring(job.id);
        setView("edit");
    };

    const pill = (active: boolean) =>
        `px-6 md:px-8 py-4 rounded-[2rem] font-black text-sm uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            active
                ? "bg-black text-white shadow-xl shadow-black/20"
                : "bg-white text-black border-2 border-black/10 hover:border-black shadow-sm"
        }`;

    const showPanel = activeJob !== null && (view === "library" || view === "edit");

    return (
        <div className="max-w-[1280px] mx-auto p-6 md:p-12 space-y-12">
            {/* Top Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-black/5 pb-12">
                <div className="space-y-2">
                    <h1 className="text-4xl font-black tracking-tight text-gray-900 leading-none">
                        Welcome, {userName}!
                    </h1>
                    <p className="text-lg text-black/40 font-bold">
                        Manage your professional library and tailor your resume.
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    {view === "edit" ? (
                        <>
                            <button onClick={discardDraft} disabled={isSaving} className={pill(false)}>
                                Discard
                            </button>
                            <button onClick={handleSaveAndExit} disabled={isSaving} className={pill(true)}>
                                {isSaving ? (staleInputs(resumeData).length > 0 ? "Analysing skills & saving…" : "Saving…") : "Save & Exit"}
                            </button>
                        </>
                    ) : view !== "library" && view !== "preview" ? (
                        <button onClick={() => setView("library")} className={pill(false)}>
                            Back to Library
                        </button>
                    ) : (
                        <>
                            <button onClick={() => setView("import")} className={pill(false)}>
                                Import Resume
                            </button>
                            <button onClick={openEditor} className={pill(false)}>
                                Master Editor
                            </button>
                            <button onClick={() => setView("insights")} className={pill(false)}>
                                Insights
                            </button>
                            <button onClick={() => setView("jobs")} className={pill(false)}>
                                Job Match
                            </button>
                            <button
                                onClick={() => setView(view === "preview" ? "library" : "preview")}
                                className={pill(view === "preview")}
                            >
                                {view === "preview" ? "Exit Preview" : "Generate Resume"}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {saveError && (
                <div role="alert" className="border-2 border-red-200 bg-red-50 rounded-2xl p-5 text-red-800 text-sm font-bold">
                    {saveError}
                </div>
            )}
            {notice && (view === "edit" || view === "library") && (
                <div role="status" className={`border-2 rounded-2xl p-5 text-sm font-bold flex items-start justify-between gap-4 ${notice.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                    <span>{notice.text}</span>
                    <button type="button" onClick={() => setNotice(null)} className="opacity-50 hover:opacity-100 font-black uppercase text-[10px] tracking-widest shrink-0">
                        Dismiss
                    </button>
                </div>
            )}

            {view === "edit" ? (
                <div className="bg-white border-2 border-black/5 rounded-[3rem] overflow-hidden shadow-2xl shadow-black/5">
                    <ResumeForm
                        resumeData={resumeData}
                        onChange={updateDraft}
                        onSaveAndExit={handleSaveAndExit}
                        isSaving={isSaving}
                        variantUsage={variantUsage}
                    />
                </div>
            ) : view === "preview" ? (
                <div className="bg-gray-100 p-6 md:p-10 rounded-[3rem] shadow-2xl">
                    <ResumePreview resumeData={resumeData} />
                </div>
            ) : view === "import" ? (
                <ResumeImport current={resumeData} onImport={handleImport} onCancel={() => setView("library")} />
            ) : view === "insights" ? (
                <InsightsView data={resumeData} />
            ) : view === "jobs" ? (
                <JobMatchView
                    jobs={jobs}
                    preferences={preferences}
                    aliases={tagAliases}
                    variants={variants}
                    resumeData={resumeData}
                    activeJobId={activeJobId}
                    selectedJobId={selectedJobId ?? activeJobId ?? jobs[0]?.id ?? null}
                    onSelectJob={setSelectedJobId}
                    onTailor={(id) => { setTailoring(id); if (id) setView("library"); }}
                    onApplyProposal={handleApplyProposal}
                    onImportExternal={(r) => {
                        const items: ImportSelection["items"] = {};
                        for (const key of RESUME_LIST_KEYS) if (r.data[key].length) (items[key] as unknown[]) = r.data[key];
                        handleImport({ personalInfo: r.data.personalInfo, replacePersonal: false, items }, { fileNames: [r.fileName] });
                    }}
                    externalResume={externalResume}
                    onExternalResume={setExternalResume}
                />
            ) : (
                <div className="space-y-12">
                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 px-4">
                        <div className="flex flex-col gap-1">
                            <h2 className="font-black text-gray-900 uppercase text-[11px] tracking-[0.3em] opacity-30">Master Library</h2>
                            <p className="text-sm text-black/55 font-medium italic">Toggle items to include them in your next generated resume.</p>
                        </div>
                        <VariantToolbar
                            variants={variants}
                            loadedVariantId={loadedVariantId}
                            data={initialResumeData}
                            onNotice={(text, tone = "ok") => setNotice({ tone, text })}
                        />
                    </div>

                    <SelectionDisplay
                        experiences={experiences}
                        educations={educations}
                        skills={skills}
                        projects={projects}
                        certifications={certifications}
                        awards={awards}
                        volunteering={volunteering}
                        publications={publications}
                        languages={languages}
                        onImport={() => setView("import")}
                        onEdit={openEditor}
                        variantUsage={variantUsage}
                    />
                </div>
            )}

            {showPanel && activeJob && (
                <JobContextPanel
                    job={activeJob}
                    data={resumeData}
                    aliases={tagAliases}
                    reanalyzing={reanalyzing}
                    onReanalyze={reanalyze}
                    onSuggestions={() => { setSelectedJobId(activeJob.id); setView("jobs"); }}
                    onExit={() => setTailoring(null)}
                />
            )}

            <ConfirmDialog
                open={confirmVariants !== null}
                title="These edits affect saved variants"
                confirmLabel="Save anyway"
                busy={isSaving}
                onCancel={() => setConfirmVariants(null)}
                onConfirm={() => void doSave()}
            >
                <p>Variants only point at library items, so the changed text will show up in every variant that includes those items:</p>
                <ul className="list-disc ml-5 font-bold">{confirmVariants?.map(v => <li key={v}>{v}</li>)}</ul>
            </ConfirmDialog>

            <ConfirmDialog
                open={confirmDiscard}
                title="Discard your unsaved changes?"
                confirmLabel="Discard"
                danger
                onCancel={() => setConfirmDiscard(false)}
                onConfirm={doDiscard}
            >
                <p>Edits and imported items that have not been saved will be lost.</p>
            </ConfirmDialog>
        </div>
    );
}
