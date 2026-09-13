// src/components/ui/selection-display.tsx
"use client"

import React from "react";
import { deleteExperience, updateExperience } from "@/app/actions/experience-actions"
import { deleteEducation, updateEducation } from "@/app/actions/education-actions"
import { deleteSkill, updateSkill } from "@/app/actions/skill-actions"
import { deleteProject, updateProject } from "@/app/actions/project-actions"
import { deleteCertification, updateCertification } from "@/app/actions/certification-actions"
import type { CertificationItem, EducationItem, ExperienceItem, ProjectItem, SkillCategoryItem } from "@/types/db"
import { formatDateRange, PRESENT } from "@/lib/dates"

interface SelectionDisplayProps {
    experiences: ExperienceItem[];
    educations: EducationItem[];
    skills: SkillCategoryItem[];
    projects: ProjectItem[];
    certifications: CertificationItem[];
}

export default function SelectionDisplay({ experiences, educations, skills, projects, certifications }: SelectionDisplayProps) {
    const hasItems =
        experiences.length > 0 ||
        educations.length > 0 ||
        skills.length > 0 ||
        projects.length > 0 ||
        certifications.length > 0;

    if (!hasItems) {
        return (
            <div className="p-20 border-2 border-dashed border-black/5 rounded-[2.5rem] text-center bg-gray-50/50">
                <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <LibraryIcon className="w-8 h-8 text-black/20" />
                </div>
                <p className="text-black/40 font-bold text-xl tracking-tight">Your library is empty.</p>
                <p className="text-black/30 text-sm mt-1">Open the Master Editor to add experience, education, projects, skills or certifications.</p>
            </div>
        );
    }

    return (
        <div className="space-y-16 pb-20">
            {experiences.length > 0 && (
                <LibrarySection icon={<BriefcaseIcon className="w-6 h-6 text-white" />} color="bg-black shadow-black/10" title="Professional Experience" subtitle="Work history & roles">
                    {experiences.map((exp) => (
                        <SelectionCard
                            key={exp.id}
                            id={exp.id}
                            title={exp.position}
                            subtitle={exp.company}
                            startDate={exp.startDate}
                            endDate={exp.endDate}
                            isActive={exp.isActive}
                            isSelected={exp.isSelected}
                            onUpdate={updateExperience}
                            onDelete={deleteExperience}
                            type="experience"
                        >
                            <BulletList items={exp.description} />
                        </SelectionCard>
                    ))}
                </LibrarySection>
            )}

            {educations.length > 0 && (
                <LibrarySection icon={<GraduationIcon className="w-6 h-6 text-white" />} color="bg-blue-600 shadow-blue-600/10" title="Academic History" subtitle="Schools & programs">
                    {educations.map((edu) => (
                        <SelectionCard
                            key={edu.id}
                            id={edu.id}
                            title={edu.programName}
                            subtitle={edu.schoolName}
                            startDate={edu.startDate}
                            endDate={edu.endDate}
                            isActive={edu.isActive}
                            isSelected={edu.isSelected}
                            onUpdate={updateEducation}
                            onDelete={deleteEducation}
                            type="education"
                        >
                            <div className="space-y-3">
                                {edu.locationCity && (
                                    <div className="flex items-center gap-2 text-black/55">
                                        <MapPinIcon className="w-4 h-4" />
                                        <p className="text-sm font-medium">{edu.locationCity}{edu.locationProvince ? `, ${edu.locationProvince}` : ""}</p>
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-2">
                                    {edu.gpa && <Chip label="GPA" value={edu.gpa} />}
                                    {edu.minorName && <Chip label="Minor" value={edu.minorName} />}
                                </div>
                                {edu.details && <p className="text-sm text-black/55 leading-relaxed">{edu.details}</p>}
                            </div>
                        </SelectionCard>
                    ))}
                </LibrarySection>
            )}

            {projects.length > 0 && (
                <LibrarySection icon={<FolderIcon className="w-6 h-6 text-white" />} color="bg-emerald-600 shadow-emerald-600/10" title="Projects" subtitle="Things you built">
                    {projects.map((project) => (
                        <SelectionCard
                            key={project.id}
                            id={project.id}
                            title={project.title}
                            subtitle={project.stack ?? ""}
                            startDate={project.startDate}
                            endDate={project.endDate}
                            isActive={project.isActive}
                            isSelected={project.isSelected}
                            onUpdate={updateProject}
                            onDelete={deleteProject}
                            type="project"
                        >
                            <div className="space-y-3">
                                {project.link && <p className="text-sm font-bold text-black/55 break-all">{project.link}</p>}
                                <BulletList items={project.description} />
                            </div>
                        </SelectionCard>
                    ))}
                </LibrarySection>
            )}

            {skills.length > 0 && (
                <LibrarySection icon={<CodeIcon className="w-6 h-6 text-white" />} color="bg-purple-600 shadow-purple-600/10" title="Skills & Expertise" subtitle="Technical & professional skills">
                    {skills.map((skill) => (
                        <SimpleCard
                            key={skill.id}
                            id={skill.id}
                            title={skill.category}
                            body={skill.items}
                            isSelected={skill.isSelected}
                            onUpdate={updateSkill}
                            onDelete={deleteSkill}
                        />
                    ))}
                </LibrarySection>
            )}

            {certifications.length > 0 && (
                <LibrarySection icon={<AwardIcon className="w-6 h-6 text-white" />} color="bg-amber-500 shadow-amber-500/10" title="Certifications" subtitle="Credentials & licenses">
                    {certifications.map((cert) => (
                        <SimpleCard
                            key={cert.id}
                            id={cert.id}
                            title={cert.name}
                            body={[cert.issuer, cert.year].filter(Boolean).join(" · ")}
                            isSelected={cert.isSelected}
                            onUpdate={updateCertification}
                            onDelete={deleteCertification}
                        />
                    ))}
                </LibrarySection>
            )}
        </div>
    )
}

// --- SUB-COMPONENTS ---

function LibrarySection({ icon, color, title, subtitle, children }: { icon: React.ReactNode; color: string; title: string; subtitle: string; children: React.ReactNode }) {
    return (
        <section className="space-y-8">
            <div className="flex items-center gap-4 px-2">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${color}`}>
                    {icon}
                </div>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h2>
                    <p className="text-sm text-black/40 font-medium italic">{subtitle}</p>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {children}
            </div>
        </section>
    );
}

function BulletList({ items }: { items: string[] }) {
    if (items.length === 0) return null;
    return (
        <ul className="list-disc list-outside ml-4 text-sm text-black/55 space-y-2">
            {items.map((line, i) => (
                <li key={i} className="pl-1 leading-relaxed">{line}</li>
            ))}
        </ul>
    );
}

function Chip({ label, value }: { label: string; value: string }) {
    return (
        <div className="inline-flex items-center px-3 py-1 bg-black/5 rounded-full border border-black/5">
            <span className="text-[10px] font-black uppercase tracking-widest text-black/40 mr-2">{label}</span>
            <span className="text-sm font-bold text-black/80">{value}</span>
        </div>
    );
}

const cardClass = (isSelected: boolean) =>
    `group relative bg-white p-8 border-[1.5px] transition-all flex flex-col h-full rounded-[2rem] overflow-hidden ${
        isSelected
            ? "border-black ring-4 ring-black/5 shadow-2xl shadow-black/5 z-10 scale-[1.02]"
            : "border-black/5 shadow-sm hover:shadow-xl hover:border-black/20 hover:scale-[1.01]"
    }`;

type ServerAction = (id: string, formData: FormData) => Promise<void>;

function IncludeToggle({ id, isSelected, onUpdate }: { id: string; isSelected: boolean; onUpdate: ServerAction }) {
    return (
        <form action={onUpdate.bind(null, id)} className="w-full">
            <input type="hidden" name="isSelected" value={(!isSelected).toString()} />
            <button
                type="submit"
                className={`w-full py-3.5 rounded-2xl text-[13px] font-black transition-all flex items-center justify-center gap-2 ${
                    isSelected
                        ? "bg-black text-white shadow-lg shadow-black/20 hover:bg-black/80"
                        : "bg-white text-black border-2 border-black/10 hover:border-black hover:bg-black/5 shadow-sm"
                }`}
            >
                {isSelected ? (
                    <>
                        <CheckIcon className="w-4 h-4" />
                        Included
                    </>
                ) : (
                    "Add to Resume"
                )}
            </button>
        </form>
    );
}

function DeleteButton({ id, onDelete }: { id: string; onDelete: (id: string) => Promise<void> }) {
    return (
        <form action={onDelete.bind(null, id)}>
            <button type="submit" title="Delete" className="absolute top-6 right-6 text-black/10 hover:text-red-500 p-2.5 hover:bg-red-50 rounded-2xl transition-all active:scale-90">
                <TrashIcon className="h-5 w-5" />
            </button>
        </form>
    );
}

const ACTIVE_LABEL = { experience: "Currently Here", education: "Active Student", project: "Ongoing" } as const;

interface SelectionCardProps {
    id: string;
    title: string;
    subtitle: string;
    startDate: string | null;
    endDate?: string | null;
    isActive: boolean;
    isSelected: boolean;
    onUpdate: ServerAction;
    onDelete: (id: string) => Promise<void>;
    type: keyof typeof ACTIVE_LABEL;
    children?: React.ReactNode;
}

function SelectionCard({ id, title, subtitle, startDate, endDate, isActive, isSelected, onUpdate, onDelete, type, children }: SelectionCardProps) {
    const dateLabel = formatDateRange(startDate, isActive ? PRESENT : endDate);
    return (
        <div className={cardClass(isSelected)}>
            <div className="flex justify-between items-start mb-6">
                <div className="space-y-1 pr-12">
                    <h3 className="font-black text-xl text-gray-900 leading-[1.1] tracking-tight">{title}</h3>
                    {subtitle && <p className="text-black/60 font-bold text-base">{subtitle}</p>}
                    <div className="flex items-center gap-2.5 mt-3">
                        <div className={`h-2 w-2 rounded-full ${isActive ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-black/10"}`}></div>
                        <p className="text-[11px] text-black/40 uppercase tracking-[0.1em] font-black">
                            {dateLabel || "No dates"}
                        </p>
                    </div>
                </div>
                <DeleteButton id={id} onDelete={onDelete} />
            </div>

            <div className="flex-1 mb-10">{children}</div>

            <div className="grid grid-cols-2 gap-3 pt-6 border-t border-black/5 mt-auto">
                <IncludeToggle id={id} isSelected={isSelected} onUpdate={onUpdate} />
                <form action={onUpdate.bind(null, id)} className="w-full">
                    <input type="hidden" name="isActive" value={(!isActive).toString()} />
                    <button
                        type="submit"
                        className={`w-full py-3.5 rounded-2xl text-[13px] font-black transition-all flex items-center justify-center gap-2 ${
                            isActive
                                ? "bg-blue-50 text-blue-600 border-2 border-blue-200"
                                : "bg-gray-50 text-black/30 border-2 border-transparent hover:bg-gray-100"
                        }`}
                    >
                        {isActive ? ACTIVE_LABEL[type] : "Mark Finished"}
                    </button>
                </form>
            </div>

            {isSelected && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-black pointer-events-none transform rotate-45 translate-x-12 -translate-y-12"></div>
            )}
        </div>
    )
}

// Card for items without dates or an active state (skills, certifications).
interface SimpleCardProps {
    id: string;
    title: string;
    body: string;
    isSelected: boolean;
    onUpdate: ServerAction;
    onDelete: (id: string) => Promise<void>;
}

function SimpleCard({ id, title, body, isSelected, onUpdate, onDelete }: SimpleCardProps) {
    return (
        <div className={cardClass(isSelected)}>
            <div className="flex justify-between items-start mb-6">
                <div className="space-y-1 pr-12">
                    <h3 className="font-black text-xl text-gray-900 leading-[1.1] tracking-tight">{title}</h3>
                </div>
                <DeleteButton id={id} onDelete={onDelete} />
            </div>

            <div className="flex-1 mb-10">
                {body && <p className="text-black/60 font-medium leading-relaxed">{body}</p>}
            </div>

            <div className="pt-6 border-t border-black/5 mt-auto">
                <IncludeToggle id={id} isSelected={isSelected} onUpdate={onUpdate} />
            </div>

            {isSelected && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-black pointer-events-none transform rotate-45 translate-x-12 -translate-y-12"></div>
            )}
        </div>
    )
}

// --- LOCAL ICONS ---

const iconProps = { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function CodeIcon({ className }: { className?: string }) {
    return (
        <svg {...iconProps} className={className}>
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
        </svg>
    );
}

function TrashIcon({ className }: { className?: string }) {
    return (
        <svg {...iconProps} className={className}>
            <path d="M3 6h18"></path>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
        </svg>
    );
}

function CheckIcon({ className }: { className?: string }) {
    return (
        <svg {...iconProps} strokeWidth={3} className={className}>
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
    );
}

function BriefcaseIcon({ className }: { className?: string }) {
    return (
        <svg {...iconProps} className={className}>
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
        </svg>
    );
}

function GraduationIcon({ className }: { className?: string }) {
    return (
        <svg {...iconProps} className={className}>
            <path d="M22 10L12 5 2 10l10 5 10-5z"></path>
            <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>
        </svg>
    );
}

function FolderIcon({ className }: { className?: string }) {
    return (
        <svg {...iconProps} className={className}>
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
    );
}

function AwardIcon({ className }: { className?: string }) {
    return (
        <svg {...iconProps} className={className}>
            <circle cx="12" cy="8" r="6"></circle>
            <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"></path>
        </svg>
    );
}

function LibraryIcon({ className }: { className?: string }) {
    return (
        <svg {...iconProps} strokeWidth={2} className={className}>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>
    );
}

function MapPinIcon({ className }: { className?: string }) {
    return (
        <svg {...iconProps} className={className}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
        </svg>
    );
}
