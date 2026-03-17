"use client";

import React, { useState } from 'react';
import { ResumeData } from "@/types/schema";
import { ResumeForm } from "@/components/ui/resume-form";
import SelectionDisplay from "@/components/ui/selection-display";
import { ExperienceItem } from "@/app/actions/experience-actions";
import { EducationItem } from "@/app/actions/education-actions";

import { ResumePreview } from "@/components/ui/resume-preview";

interface DashboardClientProps {
    initialExperiences: ExperienceItem[];
    initialEducations: EducationItem[];
    userName: string;
}

export default function DashboardClient({ initialExperiences, initialEducations, userName }: DashboardClientProps) {
    const [view, setView] = useState<'library' | 'edit' | 'preview'>('library');
    const [resumeData, setResumeData] = useState<ResumeData>({
        personalInfo: {
            fullName: "",
            email: "",
            phone: "",
            location: "",
            summary: "",
        },
        workExperience: [],
        education: [],
        skills: [],
    });

    // SYNC LOCAL STATE WITH LIBRARY PROPS
    // This ensures Generate Resume view is updated when selection toggles in SelectionDisplay
    React.useEffect(() => {
        setResumeData(prev => ({
            ...prev,
            workExperience: initialExperiences.map(e => ({
                id: e.id,
                title: e.position,
                company: e.company,
                startDate: e.startDate ? e.startDate.split("T")[0] : "",
                endDate: e.isActive ? "Present" : (e.endDate ? e.endDate.split("T")[0] : ""),
                description: e.description.join("\n"),
                isSelected: e.isSelected,
            })),
            education: initialEducations.map(e => ({
                id: e.id,
                degree: e.programName,
                institution: e.schoolName,
                year: `${e.startDate ? new Date(e.startDate).getFullYear() : ''} - ${e.isActive ? 'Present' : (e.endDate ? new Date(e.endDate).getFullYear() : '')}`,
                details: e.gpa || "",
                isSelected: e.isSelected,
            })),
        }));
    }, [initialExperiences, initialEducations]);

    return (
        <div className="max-w-[1280px] mx-auto p-6 md:p-12 space-y-12">
            {/* Top Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-black/5 pb-12">
                <div className="space-y-2">
                    <h1 className="text-4xl font-black tracking-tight text-gray-900 leading-none">
                        Welcome back, {userName}!
                    </h1>
                    <p className="text-lg text-black/40 font-bold">
                        Manage your professional library and tailor your resume.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setView(view === 'edit' ? 'library' : 'edit')}
                        className={`px-8 py-4 rounded-[2rem] font-black text-sm uppercase tracking-widest transition-all ${
                            view === 'edit' 
                            ? 'bg-black text-white shadow-xl shadow-black/20' 
                            : 'bg-white text-black border-2 border-black/10 hover:border-black shadow-sm'
                        }`}
                    >
                        {view === 'edit' ? 'Close Editor' : 'Master Editor'}
                    </button>
                    <button 
                        onClick={() => setView(view === 'preview' ? 'library' : 'preview')}
                        className={`px-8 py-4 rounded-[2rem] font-black text-sm uppercase tracking-widest transition-all ${
                            view === 'preview' 
                            ? 'bg-black text-white shadow-xl shadow-black/20' 
                            : 'bg-white text-black border-2 border-black/10 hover:border-black shadow-sm'
                        }`}
                    >
                        {view === 'preview' ? 'Exit Preview' : 'Generate Resume'}
                    </button>
                </div>
            </div>

            {view === 'edit' ? (
                <div className="bg-white border-2 border-black/5 rounded-[3rem] overflow-hidden shadow-2xl shadow-black/5">
                    <ResumeForm 
                        resumeData={resumeData} 
                        onChange={setResumeData} 
                    />
                </div>
            ) : view === 'preview' ? (
                <div className="max-w-[900px] mx-auto bg-gray-100 p-8 rounded-[3rem] shadow-2xl">
                    <div className="bg-white shadow-2xl rounded-sm overflow-hidden">
                        <ResumePreview resumeData={resumeData} />
                    </div>
                </div>
            ) : (
                <div className="space-y-12">
                    <div className="flex flex-col gap-1 px-4">
                        <h2 className="text-xl font-black text-gray-900 tracking-tighter uppercase text-[11px] tracking-[0.3em] opacity-30">Master Library</h2>
                        <p className="text-sm text-black/55 font-medium italic">Toggle items to include them in your next generated resume.</p>
                    </div>
                    
                    <SelectionDisplay 
                        experiences={initialExperiences} 
                        educations={initialEducations} 
                    />
                </div>
            )}
        </div>
    );
}
