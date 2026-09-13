"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { ResumeData, ResumeListKey } from "@/types/schema";
import { RESUME_LIST_KEYS } from "@/types/schema";
import type { ResumeVariant } from "@/types/db";
import type { JobRecord, Preferences, Proposal } from "@/lib/match/types";
import type { AliasMap } from "@/lib/tags/normalize";
import { ResumeForm } from "@/components/ui/editor/resume-form";
import { LibraryView, libraryCounts, type LibraryLists } from "@/components/ui/library/library-view";
import { ResumeImport } from "@/components/ui/resume-import";
import { InsightsView } from "@/components/ui/insights-view";
import { JobMatchView, type ExternalResume } from "@/components/ui/job-match-view";
import { VariantToolbar } from "@/components/ui/variant-toolbar";
import { SectionTabs, type SectionTab } from "@/components/ui/section-tabs";
import { TopBar } from "@/components/ui/primitives/top-bar";
import { Button, IconButton } from "@/components/ui/primitives/button";
import { ConfirmDialog, Dialog } from "@/components/ui/primitives/dialog";
import { NoticeBanner } from "@/components/ui/primitives/notice-banner";
import { PanelRight, PenLine, Upload } from "@/components/ui/primitives/icons";
import { parseView, useDashboardView, VIEW_TITLE, viewHref } from "@/lib/ui/use-dashboard-view";
import { setLeaveGuard } from "@/lib/ui/leave-guard";
import { useMediaQuery, XL } from "@/lib/ui/use-media-query";
import { PANE_MIN, setPreviewPane, togglePreviewPane, usePreviewPane, usePreviewPaneWidth } from "@/lib/ui/preview-pane-store";
import { PaneResizeHandle } from "@/components/ui/pane-resize-handle";
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
import { contentHashOf, staleInputs } from "@/lib/tags/content";
import { applyProposal } from "@/lib/match/proposals";
import { itemTitle } from "@/lib/sections";
import { cn } from "@/lib/cn";

// The preview compiles Typst in the browser (wasm), so it must never render on the server.
const ResumePreview = dynamic(
    () => import("@/components/ui/resume-preview").then(m => m.ResumePreview),
    {
        ssr: false,
        loading: () => (
            <div className="mx-auto flex aspect-[210/297] w-full max-w-[210mm] items-center justify-center border border-border bg-white">
                <span className="text-13 text-fg-subtle">Loading preview…</span>
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

interface DashboardClientProps extends LibraryLists {
    /** Complete editor model built on the server (profile + all subcollections). */
    initialResumeData: ResumeData;
    variants: ResumeVariant[];
    variantUsage: Record<string, string[]>;
    loadedVariantId: string | null;
    jobs: JobRecord[];
    preferences: Preferences;
    tagAliases: AliasMap;
    userName: string;
}

type Notice = { tone: "ok" | "warn"; text: string };

export default function DashboardClient(props: DashboardClientProps) {
    // useSearchParams (inside useDashboardView) needs a Suspense boundary.
    return (
        <Suspense fallback={null}>
            <DashboardClientInner {...props} />
        </Suspense>
    );
}

function DashboardClientInner({
    initialResumeData,
    experiences, educations, skills, projects, certifications, awards, volunteering, publications, languages,
    variants,
    variantUsage,
    loadedVariantId,
    jobs,
    preferences,
    tagAliases,
}: DashboardClientProps) {
    const router = useRouter();
    const [view, setView] = useDashboardView();
    const wide = useMediaQuery(XL);
    const paneWanted = usePreviewPane();
    const paneOpen = wide && paneWanted && view !== "preview";
    const storedPaneWidth = usePreviewPaneWidth();
    const [dragWidth, setDragWidth] = useState<number | null>(null);
    const paneWidth = dragWidth ?? storedPaneWidth;
    const gridRef = useRef<HTMLDivElement>(null);

    const [libraryTab, setLibraryTab] = useState<SectionTab>("all");
    const [editorTab, setEditorTab] = useState<SectionTab>("all");
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [notice, setNotice] = useState<Notice | null>(null);
    /** Variants affected by the edits being saved, and where to go after saving (null = Library). */
    const [confirmVariants, setConfirmVariants] = useState<{ names: string[]; target: string | null } | null>(null);
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    /** In-app navigation away from the editor with unsaved changes, waiting for Save / Discard / Keep editing. */
    const [pendingLeave, setPendingLeave] = useState<string | null>(null);

    // Job Match state
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [externalResume, setExternalResume] = useState<ExternalResume | null>(null);

    // Draft model: `draft` is null unless the editor is open. Everything else
    // reads server truth from props, which Next refreshes after each server
    // action (revalidatePath). Because the draft is never re-derived from
    // props, a revalidation can't clobber unsaved edits. The draft only lives
    // in the editor: other views always read server truth (so a draft can never
    // hide what Job Match / variants just wrote), leaving the editor asks to
    // save or discard, and leaving through browser Back discards it.
    const [draft, setDraft] = useState<ResumeData | null>(null);
    const editorDraft = draft ?? initialResumeData;
    const resumeData = view === "editor" ? editorDraft : initialResumeData;
    const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(initialResumeData);

    // Sidebar links ask before leaving an editor with unsaved changes; reload / closing the tab gets the browser prompt.
    useEffect(() => {
        if (view !== "editor" || !dirty) return;
        const uninstall = setLeaveGuard(href => {
            if (href === viewHref("editor")) return false;
            setPendingLeave(href);
            return true;
        });
        const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => {
            uninstall();
            window.removeEventListener("beforeunload", onBeforeUnload);
        };
    }, [view, dirty]);

    // Browser Back / Forward out of the editor cannot be intercepted: the draft is reverted.
    const hasDraft = draft !== null;
    useEffect(() => {
        if (!hasDraft) return;
        const onPop = () => {
            const url = new URL(window.location.href);
            if (url.pathname !== "/dashboard" || parseView(url.searchParams.get("view")) !== "editor") {
                setDraft(null);
                setSaveError(null);
            }
        };
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
    }, [hasDraft]);

    const updateDraft = (updater: (prev: ResumeData) => ResumeData) => {
        setDraft(prev => updater(prev ?? initialResumeData));
    };

    const openEditor = (tab?: SectionTab) => {
        // Keep an in-progress draft (e.g. one seeded by an import) if there is one.
        setDraft(prev => prev ?? initialResumeData);
        setSaveError(null);
        if (tab) setEditorTab(tab);
        setView("editor");
    };

    const doDiscard = () => {
        setConfirmDiscard(false);
        setDraft(null);
        setSaveError(null);
        setNotice(null);
        setView("library", { replace: true });
    };
    const discardDraft = () => {
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

    /** Saves the draft, then goes to `target` (another page / view) or back to the Library. */
    const doSave = async (target: string | null = null) => {
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
                if (target) router.push(target, { scroll: false });
                else setView("library", { replace: true });
            }
        } catch (error) {
            console.error("Failed to save:", error);
            setSaveError(error instanceof Error ? error.message : "Failed to save your library changes.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveAndExit = (target: string | null = null) => {
        if (!draft) {
            if (target) router.push(target, { scroll: false });
            else setView("library", { replace: true });
            return;
        }
        const affected = [...new Set(changedItemIds().flatMap(id => variantUsage[id] ?? []))];
        if (affected.length > 0) { setConfirmVariants({ names: affected, target }); return; }
        void doSave(target);
    };

    const leaveDiscarding = () => {
        const href = pendingLeave;
        setPendingLeave(null);
        setDraft(null);
        setSaveError(null);
        setNotice(null);
        if (href) router.push(href, { scroll: false });
    };
    const leaveSaving = () => {
        const href = pendingLeave;
        setPendingLeave(null);
        handleSaveAndExit(href);
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
        setEditorTab("all");
        setView("editor");
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
        setEditorTab(p.section);
        setView("editor");
    };

    const lists: LibraryLists = { experiences, educations, skills, projects, certifications, awards, volunteering, publications, languages };
    const counts = libraryCounts(lists);
    const draftCounts = Object.fromEntries(RESUME_LIST_KEYS.map(k => [k, editorDraft[k].length])) as Record<ResumeListKey, number>;

    const previewToggle = wide
        ? <IconButton icon={PanelRight} aria-label={paneWanted ? "Hide preview pane" : "Show preview pane"} aria-pressed={paneWanted} variant={paneWanted ? "secondary" : "ghost"} size="md" onClick={togglePreviewPane} />
        : <Button variant="ghost" onClick={() => setView("preview")}>Preview</Button>;

    const actions =
        view === "editor" ? (
            <>
                <span className={cn("hidden items-center gap-1.5 text-13 sm:flex", dirty ? "text-fg-muted" : "text-fg-subtle")} aria-live="polite">
                    <span className={cn("size-1.5 rounded-full", dirty ? "bg-warning" : "bg-border-strong")} aria-hidden />
                    {dirty ? "Unsaved changes" : "No changes"}
                </span>
                <Button variant="ghost" onClick={discardDraft} disabled={isSaving}>Discard</Button>
                <Button variant="primary" onClick={() => handleSaveAndExit()} loading={isSaving}>
                    {isSaving ? (staleInputs(resumeData).length > 0 ? "Analysing & saving…" : "Saving…") : "Save & Exit"}
                </Button>
            </>
        ) : view === "library" ? (
            <>
                <Button variant="ghost" icon={Upload} onClick={() => setView("import")} className="hidden sm:inline-flex">Import</Button>
                <Button variant="primary" icon={PenLine} onClick={() => openEditor(libraryTab)}>Edit</Button>
                {previewToggle}
            </>
        ) : view === "preview" ? (
            wide ? <Button variant="secondary" onClick={() => { setPreviewPane(true); setView("library", { replace: true }); }}>Dock as side pane</Button> : null
        ) : (
            <Button variant="ghost" onClick={() => setView("library")}>Back to library</Button>
        );

    const tabs =
        view === "library" ? <SectionTabs counts={counts} value={libraryTab} onChange={setLibraryTab} />
        : view === "editor" ? <SectionTabs counts={draftCounts} value={editorTab} onChange={setEditorTab} showEmpty withProfile />
        : undefined;

    const body =
        view === "editor" ? (
            <ResumeForm
                resumeData={editorDraft}
                onChange={updateDraft}
                variantUsage={variantUsage}
                tab={editorTab}
            />
        ) : view === "preview" ? (
            <ResumePreview resumeData={resumeData} />
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
                selectedJobId={selectedJobId ?? jobs[0]?.id ?? null}
                onSelectJob={setSelectedJobId}
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
            <div className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-13 text-fg-muted">Toggle items to include them on your résumé. Click a row for details.</p>
                    <VariantToolbar
                        variants={variants}
                        loadedVariantId={loadedVariantId}
                        data={initialResumeData}
                        onNotice={(text, tone = "ok") => setNotice({ tone, text })}
                    />
                </div>
                <LibraryView {...lists} tab={libraryTab} variantUsage={variantUsage} onImport={() => setView("import")} onEdit={() => openEditor()} />
            </div>
        );

    return (
        <>
            <TopBar
                title={VIEW_TITLE[view]}
                actions={actions}
                tabs={tabs}
            />

            <div
                ref={gridRef}
                className={cn("flex-1", paneOpen && "xl:grid")}
                // clamp(): the 50% cap follows window resizes without JS.
                style={paneOpen ? { gridTemplateColumns: `minmax(0,1fr) clamp(${PANE_MIN}px, ${paneWidth}px, 50%)` } : undefined}
            >
                <main className="min-w-0 p-4 pb-16 md:p-6">
                    {/* Job Match is a two-column workspace: let it use the full width left of the pane. */}
                    <div className={cn("mx-auto space-y-4", view === "jobs" ? "max-w-[1600px]" : "max-w-5xl")}>
                        {saveError && <NoticeBanner tone="danger" onDismiss={() => setSaveError(null)}>{saveError}</NoticeBanner>}
                        {notice && (view === "editor" || view === "library") && (
                            <NoticeBanner tone={notice.tone === "ok" ? "success" : "warning"} onDismiss={() => setNotice(null)}>{notice.text}</NoticeBanner>
                        )}
                        {body}
                    </div>
                </main>
                {paneOpen && (
                    <aside className="hidden xl:block sticky top-14 h-[calc(100dvh-3.5rem)] border-l border-border bg-surface-muted/60" aria-label="Résumé preview">
                        <PaneResizeHandle containerRef={gridRef} width={paneWidth} onDrag={setDragWidth} />
                        <ResumePreview resumeData={resumeData} compact onClose={() => setPreviewPane(false)} />
                    </aside>
                )}
            </div>

            <ConfirmDialog
                open={confirmVariants !== null}
                title="These edits affect saved variants"
                confirmLabel="Save anyway"
                busy={isSaving}
                onCancel={() => setConfirmVariants(null)}
                onConfirm={() => void doSave(confirmVariants?.target ?? null)}
            >
                <p>Variants only point at library items, so the changed text will show up in every variant that includes those items:</p>
                <ul className="ml-5 list-disc font-medium text-fg">{confirmVariants?.names.map(v => <li key={v}>{v}</li>)}</ul>
            </ConfirmDialog>

            <Dialog
                open={pendingLeave !== null}
                onClose={() => setPendingLeave(null)}
                title="Leave the editor?"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setPendingLeave(null)}>Keep editing</Button>
                        <Button variant="secondary" onClick={leaveDiscarding}>Discard changes</Button>
                        <Button variant="primary" onClick={leaveSaving}>Save & leave</Button>
                    </>
                }
            >
                <p>You have unsaved changes. Save them first, or they are discarded when you leave.</p>
            </Dialog>

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
        </>
    );
}
