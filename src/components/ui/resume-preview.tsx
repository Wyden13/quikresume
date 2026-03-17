// src/components/ui/resume-preview.tsx
"use client";

import React from "react";
import { ResumeData } from "@/types/schema";

interface ResumePreviewProps {
    resumeData: ResumeData;
}

export function ResumePreview({ resumeData }: ResumePreviewProps) {
    const { personalInfo, workExperience = [], education = [], skills = [] } = resumeData;

    // Helper to format dates from YYYY-MM-DD to MMM YYYY
    const formatDate = (dateStr: string) => {
        if (!dateStr) return "";
        if (dateStr.toLowerCase() === "present") return "Present";
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    // Only show items that are selected
    const selectedWorkExperience = workExperience.filter(exp => exp.isSelected);
    const selectedEducation = education.filter(edu => edu.isSelected);
    const selectedSkills = skills.filter(skill => skill.isSelected);

    const handleDownload = () => {
        window.print();
    };

    return (
        <div className="flex flex-col items-center gap-8 py-12 bg-gray-100 min-h-screen">
            {/* Download Button - Hidden during print */}
            <button 
                onClick={handleDownload}
                className="fixed bottom-8 right-8 z-50 bg-black text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-black/80 transition-all active:scale-95 flex items-center gap-3 print:hidden"
            >
                <DownloadIcon className="w-5 h-5" />
                Download PDF
            </button>

            {/* A4 Container */}
            <div 
                className="bg-white text-black shadow-2xl print:shadow-none print:m-0"
                style={{
                    width: "210mm",
                    minHeight: "297mm",
                    padding: "20mm",
                    boxSizing: "border-box"
                }}
                id="resume-preview"
            >
                {/* Header */}
                <header className="mb-10 text-center border-b-2 border-black pb-8">
                    <h1 className="text-5xl font-black uppercase tracking-tighter mb-4">{personalInfo.fullName || "Your Name"}</h1>
                    <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-[13px] font-bold uppercase tracking-widest text-black/55">
                        {personalInfo.email && (
                            <div className="flex items-center gap-2">
                                <MailIcon className="w-4 h-4" />
                                <span>{personalInfo.email}</span>
                            </div>
                        )}
                        {personalInfo.phone && (
                            <div className="flex items-center gap-2">
                                <PhoneIcon className="w-4 h-4" />
                                <span>{personalInfo.phone}</span>
                            </div>
                        )}
                        {personalInfo.location && (
                            <div className="flex items-center gap-2">
                                <MapPinIcon className="w-4 h-4" />
                                <span>{personalInfo.location}</span>
                            </div>
                        )}
                    </div>
                </header>

                {/* Professional Summary */}
                {personalInfo.summary && (
                    <section className="mb-10">
                        <h2 className="text-sm font-black uppercase tracking-[0.3em] text-black/30 mb-4 flex items-center gap-4">
                            Professional Summary
                            <span className="flex-1 h-[1px] bg-black/5"></span>
                        </h2>
                        <p className="text-black font-medium leading-[1.6] text-justify whitespace-pre-line">{personalInfo.summary}</p>
                    </section>
                )}

                {/* Work Experience */}
                {selectedWorkExperience.length > 0 && (
                    <section className="mb-10">
                        <h2 className="text-sm font-black uppercase tracking-[0.3em] text-black/30 mb-6 flex items-center gap-4">
                            Work Experience
                            <span className="flex-1 h-[1px] bg-black/5"></span>
                        </h2>
                        <div className="space-y-8">
                            {selectedWorkExperience.map((exp) => (
                                <div key={exp.id}>
                                    <div className="flex justify-between items-baseline mb-2">
                                        <h3 className="text-xl font-black tracking-tight">{exp.title}</h3>
                                        <span className="text-xs font-black uppercase tracking-widest text-black/40">
                                            {formatDate(exp.startDate)} {exp.endDate && `— ${formatDate(exp.endDate)}`}
                                        </span>
                                    </div>
                                    <div className="text-base font-bold text-black/60 mb-3">{exp.company}</div>
                                    {exp.description && (
                                        <div className="text-black/70 text-sm font-medium whitespace-pre-line leading-relaxed pl-4 border-l-2 border-black/5">
                                            {exp.description.split('\n').filter(line => line.trim() !== "").map((line, i) => (
                                                <div key={i} className="mb-1">• {line}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Education */}
                {selectedEducation.length > 0 && (
                    <section className="mb-10">
                        <h2 className="text-sm font-black uppercase tracking-[0.3em] text-black/30 mb-6 flex items-center gap-4">
                            Education
                            <span className="flex-1 h-[1px] bg-black/5"></span>
                        </h2>
                        <div className="space-y-6">
                            {selectedEducation.map((edu) => (
                                <div key={edu.id}>
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h3 className="text-lg font-bold">{edu.degree}</h3>
                                        <span className="text-xs font-black uppercase tracking-widest text-black/40">{edu.year}</span>
                                    </div>
                                    <div className="text-black/60 font-semibold">{edu.institution}</div>
                                    {edu.details && <div className="text-sm text-black/40 italic mt-1">{edu.details}</div>}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Skills */}
                {selectedSkills.length > 0 && (
                    <section>
                        <h2 className="text-sm font-black uppercase tracking-[0.3em] text-black/30 mb-6 flex items-center gap-4">
                            Skills
                            <span className="flex-1 h-[1px] bg-black/5"></span>
                        </h2>
                        <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                            {selectedSkills.map((skill) => (
                                <div key={skill.id} className="flex flex-col gap-1">
                                    <span className="text-[11px] font-black uppercase tracking-widest text-black/40">{skill.category}</span>
                                    <span className="text-sm font-bold text-black/70">{skill.items}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            {/* Print styles */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    body {
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .bg-gray-100 {
                        background: white !important;
                    }
                    button, .fixed {
                        display: none !important;
                    }
                    #resume-preview {
                        width: 210mm !important;
                        min-height: 297mm !important;
                        padding: 20mm !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                    }
                    @page {
                        size: A4;
                        margin: 0;
                    }
                }
            ` }} />
        </div>
    );
}

// --- LOCAL ICONS ---
function MailIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"></rect>
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
        </svg>
    );
}

function PhoneIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
        </svg>
    );
}

function MapPinIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
            <circle cx="12" cy="10" r="3"></circle>
        </svg>
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
