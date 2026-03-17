// src/components/ui/selection-display.tsx
"use client"

import { deleteExperience, updateExperience } from "@/app/actions/experience-actions"
import { deleteEducation, updateEducation, EducationItem } from "@/app/actions/education-actions"
import { deleteSkill, updateSkill } from "@/app/actions/skill-actions"
import { ExperienceItem } from "@/app/actions/experience-actions"
import { SkillCategory } from "@/types/schema"

interface SelectionDisplayProps {
    experiences: ExperienceItem[];
    educations: EducationItem[];
    skills: SkillCategory[];
}

export default function SelectionDisplay({ experiences, educations, skills }: SelectionDisplayProps) {
    const hasItems = (experiences && experiences.length > 0) ||
        (educations && educations.length > 0) ||
        (skills && skills.length > 0);

    // Helper to format string dates
    const formatDate = (dateStr: string) => {
        if (!dateStr) return "";
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    if (!hasItems) {
        return (
            <div className="p-20 border-2 border-dashed border-black/5 rounded-[2.5rem] text-center bg-gray-50/50">
                <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <LibraryIcon className="w-8 h-8 text-black/20" />
                </div>
                <p className="text-black/40 font-bold text-xl tracking-tight">Your library is empty.</p>
                <p className="text-black/30 text-sm mt-1">Add your experience, education, or skills to get started.</p>
            </div>
        );
    }

    return (
        <div className="space-y-16 pb-20">
            {/* Experience Section */}
            {experiences && experiences.length > 0 && (
                <section className="space-y-8">
                    <div className="flex items-center gap-4 px-2">
                        <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center shadow-lg shadow-black/10">
                            <BriefcaseIcon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight text-gray-900">Professional Experience</h2>
                            <p className="text-sm text-black/40 font-medium italic">Work history & roles</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                                formatDate={formatDate}
                            >
                                {exp.description && exp.description.length > 0 && (
                                    <ul className="list-disc list-outside ml-4 text-sm text-black/55 space-y-2">
                                        {exp.description.map((line: string, i: number) => (
                                            <li key={i} className="pl-1 leading-relaxed">{line}</li>
                                        ))}
                                    </ul>
                                )}
                            </SelectionCard>
                        ))}
                    </div>
                </section>
            )}

            {/* Education Section */}
            {educations && educations.length > 0 && (
                <section className="space-y-8">
                    <div className="flex items-center gap-4 px-2">
                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/10">
                            <GraduationIcon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight text-gray-900">Academic History</h2>
                            <p className="text-sm text-black/40 font-medium italic">Schools & programs</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                                formatDate={formatDate}
                            >
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-black/55">
                                        <MapPinIcon className="w-4 h-4" />
                                        <p className="text-sm font-medium">{edu.locationCity}{edu.locationProvince ? `, ${edu.locationProvince}` : ''}</p>
                                    </div>
                                    {edu.gpa && (
                                        <div className="inline-flex items-center px-3 py-1 bg-black/5 rounded-full border border-black/5">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-black/40 mr-2">GPA</span>
                                            <span className="text-sm font-bold text-black/80">{edu.gpa}</span>
                                        </div>
                                    )}
                                </div>
                            </SelectionCard>
                        ))}
                    </div>
                </section>
            )}

            {/* Skills Section */}
            {skills && skills.length > 0 && (
                <section className="space-y-8">
                    <div className="flex items-center gap-4 px-2">
                        <div className="w-12 h-12 bg-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-600/10">
                            <CodeIcon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight text-gray-900">Skills & Expertise</h2>
                            <p className="text-sm text-black/40 font-medium italic">Technical & professional skills</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {skills.map((skill) => (
                            <SkillCard
                                key={skill.id}
                                id={skill.id}
                                category={skill.category}
                                items={skill.items}
                                isSelected={skill.isSelected}
                                onUpdate={updateSkill}
                                onDelete={deleteSkill}
                            />
                        ))}
                    </div>
                </section>
            )}
        </div>
    )
}

// --- SUB-COMPONENTS ---

interface SelectionCardProps {
    id: string;
    title: string;
    subtitle: string;
    startDate: string;
    endDate?: string | null;
    isActive: boolean;
    isSelected: boolean;
    onUpdate: (id: string, formData: FormData) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    type: 'experience' | 'education';
    children?: React.ReactNode;
    formatDate: (str: string) => string;
}

function SelectionCard({
                           id,
                           title,
                           subtitle,
                           startDate,
                           endDate,
                           isActive,
                           isSelected,
                           onUpdate,
                           onDelete,
                           type,
                           children,
                           formatDate
                       }: SelectionCardProps) {
    return (
        <div className={`group relative bg-white p-8 border-[1.5px] transition-all flex flex-col h-full rounded-[2rem] overflow-hidden ${
            isSelected
                ? 'border-black ring-4 ring-black/5 shadow-2xl shadow-black/5 z-10 scale-[1.02]'
                : 'border-black/5 shadow-sm hover:shadow-xl hover:border-black/20 hover:scale-[1.01]'
        }`}>
            {/* Header Status */}
            <div className="flex justify-between items-start mb-6">
                <div className="space-y-1 pr-12">
                    <h3 className="font-black text-xl text-gray-900 leading-[1.1] tracking-tight group-hover:text-black transition-colors">{title}</h3>
                    <p className="text-black/60 font-bold text-base">{subtitle}</p>
                    <div className="flex items-center gap-2.5 mt-3">
                        <div className={`h-2 w-2 rounded-full ${isActive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-black/10'}`}></div>
                        <p className="text-[11px] text-black/40 uppercase tracking-[0.1em] font-black">
                            {formatDate(startDate)} — {isActive ? 'Present' : formatDate(endDate || "")}
                        </p>
                    </div>
                </div>

                <form action={onDelete.bind(null, id)}>
                    <button className="absolute top-6 right-6 text-black/10 hover:text-red-500 p-2.5 hover:bg-red-50 rounded-2xl transition-all active:scale-90">
                        <TrashIcon className="h-5 w-5" />
                    </button>
                </form>
            </div>

            {/* Main Content */}
            <div className="flex-1 mb-10">
                {children}
            </div>

            {/* Enforced Toggle Footer */}
            <div className="grid grid-cols-2 gap-3 pt-6 border-t border-black/5 mt-auto">
                <form action={onUpdate.bind(null, id)} className="w-full">
                    <input type="hidden" name="isSelected" value={(!isSelected).toString()} />
                    <button
                        type="submit"
                        className={`w-full py-3.5 rounded-2xl text-[13px] font-black transition-all flex items-center justify-center gap-2 ${
                            isSelected
                                ? 'bg-black text-white shadow-lg shadow-black/20 hover:bg-black/80'
                                : 'bg-white text-black border-2 border-black/10 hover:border-black hover:bg-black/5 shadow-sm'
                        }`}
                    >
                        {isSelected ? (
                            <>
                                <CheckIcon className="w-4 h-4" />
                                Included
                            </>
                        ) : (
                            'Add to Resume'
                        )}
                    </button>
                </form>

                <form action={onUpdate.bind(null, id)} className="w-full">
                    <input type="hidden" name="isActive" value={(!isActive).toString()} />
                    <button
                        type="submit"
                        className={`w-full py-3.5 rounded-2xl text-[13px] font-black transition-all flex items-center justify-center gap-2 ${
                            isActive
                                ? 'bg-blue-50 text-blue-600 border-2 border-blue-200'
                                : 'bg-gray-50 text-black/30 border-2 border-transparent hover:bg-gray-100'
                        }`}
                    >
                        {isActive ? (type === 'education' ? 'Active Student' : 'Currently Here') : 'Mark Finished'}
                    </button>
                </form>
            </div>

            {/* Visual Indicator of inclusion */}
            {isSelected && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-black pointer-events-none transform rotate-45 translate-x-12 -translate-y-12"></div>
            )}
        </div>
    )
}

// Custom Card for Skills (Since they don't have dates/active toggles)
interface SkillCardProps {
    id: string;
    category: string;
    items: string;
    isSelected: boolean;
    onUpdate: (id: string, formData: FormData) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}

function SkillCard({ id, category, items, isSelected, onUpdate, onDelete }: SkillCardProps) {
    return (
        <div className={`group relative bg-white p-8 border-[1.5px] transition-all flex flex-col h-full rounded-[2rem] overflow-hidden ${
            isSelected
                ? 'border-black ring-4 ring-black/5 shadow-2xl shadow-black/5 z-10 scale-[1.02]'
                : 'border-black/5 shadow-sm hover:shadow-xl hover:border-black/20 hover:scale-[1.01]'
        }`}>
            <div className="flex justify-between items-start mb-6">
                <div className="space-y-1 pr-12">
                    <h3 className="font-black text-xl text-gray-900 leading-[1.1] tracking-tight group-hover:text-black transition-colors">{category}</h3>
                </div>

                <form action={onDelete.bind(null, id)}>
                    <button className="absolute top-6 right-6 text-black/10 hover:text-red-500 p-2.5 hover:bg-red-50 rounded-2xl transition-all active:scale-90">
                        <TrashIcon className="h-5 w-5" />
                    </button>
                </form>
            </div>

            <div className="flex-1 mb-10">
                <p className="text-black/60 font-medium leading-relaxed">{items}</p>
            </div>

            <div className="pt-6 border-t border-black/5 mt-auto">
                <form action={onUpdate.bind(null, id)} className="w-full">
                    <input type="hidden" name="isSelected" value={(!isSelected).toString()} />
                    <button
                        type="submit"
                        className={`w-full py-3.5 rounded-2xl text-[13px] font-black transition-all flex items-center justify-center gap-2 ${
                            isSelected
                                ? 'bg-black text-white shadow-lg shadow-black/20 hover:bg-black/80'
                                : 'bg-white text-black border-2 border-black/10 hover:border-black hover:bg-black/5 shadow-sm'
                        }`}
                    >
                        {isSelected ? (
                            <>
                                <CheckIcon className="w-4 h-4" />
                                Included
                            </>
                        ) : (
                            'Add to Resume'
                        )}
                    </button>
                </form>
            </div>

            {isSelected && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-black pointer-events-none transform rotate-45 translate-x-12 -translate-y-12"></div>
            )}
        </div>
    )
}

// --- LOCAL ICONS ---

function CodeIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
        </svg>
    );
}

function TrashIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18"></path>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
        </svg>
    );
}

function CheckIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
    );
}

function BriefcaseIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
        </svg>
    );
}

function GraduationIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10L12 5 2 10l10 5 10-5z"></path>
            <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>
        </svg>
    );
}

function LibraryIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>
    );
}

function MapPinIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
        </svg>
    );
}