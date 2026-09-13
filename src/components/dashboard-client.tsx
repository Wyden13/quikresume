"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import type { ResumeData } from "@/types/schema";
import type { CertificationItem, EducationItem, ExperienceItem, ProjectItem, SkillCategoryItem } from "@/types/db";
import { ResumeForm } from "@/components/ui/resume-form";
import SelectionDisplay from "@/components/ui/selection-display";
import { saveResumeData } from "@/app/actions/resume-actions";

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

interface DashboardClientProps {
    /** Complete editor model built on the server (profile + all subcollections). */
    initialResumeData: ResumeData;
    experiences: ExperienceItem[];
    educations: EducationItem[];
    skills: SkillCategoryItem[];
    projects: ProjectItem[];
    certifications: CertificationItem[];
    userName: string;
}

type View = "library" | "edit" | "preview";

export default function DashboardClient({
    initialResumeData,
    experiences,
    educations,
    skills,
    projects,
    certifications,
    userName,
}: DashboardClientProps) {
    const [view, setView] = useState<View>("library");
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Draft model: `draft` is null unless the editor is open. Everything else
    // reads server truth from props, which Next refreshes after each server
    // action (revalidatePath). Because the draft is never re-derived from
    // props, a revalidation can't clobber unsaved edits.
    const [draft, setDraft] = useState<ResumeData | null>(null);
    const resumeData = draft ?? initialResumeData;

    const updateDraft = (updater: (prev: ResumeData) => ResumeData) => {
        setDraft(prev => updater(prev ?? initialResumeData));
    };

    const openEditor = () => {
        setDraft(initialResumeData);
        setSaveError(null);
        setView("edit");
    };

    const discardDraft = () => {
        setDraft(null);
        setSaveError(null);
        setView("library");
    };

    const handleSaveAndExit = async () => {
        if (!draft) {
            setView("library");
            return;
        }
        setIsSaving(true);
        setSaveError(null);
        try {
            const result = await saveResumeData(draft);
            if (result.success) {
                setDraft(null);
                setView("library");
            }
        } catch (error) {
            console.error("Failed to save:", error);
            setSaveError(error instanceof Error ? error.message : "Failed to save your library changes.");
        } finally {
            setIsSaving(false);
        }
    };

    const pill = (active: boolean) =>
        `px-8 py-4 rounded-[2rem] font-black text-sm uppercase tracking-widest transition-all ${
            active
                ? "bg-black text-white shadow-xl shadow-black/20"
                : "bg-white text-black border-2 border-black/10 hover:border-black shadow-sm"
        }`;

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
                                {isSaving ? "Saving…" : "Save & Exit"}
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={openEditor} className={pill(false)}>
                                Master Editor
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
                <div className="border-2 border-red-200 bg-red-50 rounded-2xl p-5 text-red-800 text-sm font-bold">
                    {saveError}
                </div>
            )}

            {view === "edit" ? (
                <div className="bg-white border-2 border-black/5 rounded-[3rem] overflow-hidden shadow-2xl shadow-black/5">
                    <ResumeForm
                        resumeData={resumeData}
                        onChange={updateDraft}
                        onSaveAndExit={handleSaveAndExit}
                        isSaving={isSaving}
                    />
                </div>
            ) : view === "preview" ? (
                <div className="bg-gray-100 p-6 md:p-10 rounded-[3rem] shadow-2xl">
                    <ResumePreview resumeData={resumeData} />
                </div>
            ) : (
                <div className="space-y-12">
                    <div className="flex flex-col gap-1 px-4">
                        <h2 className="font-black text-gray-900 uppercase text-[11px] tracking-[0.3em] opacity-30">Master Library</h2>
                        <p className="text-sm text-black/55 font-medium italic">Toggle items to include them in your next generated resume.</p>
                    </div>

                    <SelectionDisplay
                        experiences={experiences}
                        educations={educations}
                        skills={skills}
                        projects={projects}
                        certifications={certifications}
                    />
                </div>
            )}
        </div>
    );
}
