// src/components/ui/selection-display.tsx
"use client"

import React from "react";
import { useFormStatus } from "react-dom";
import { deleteExperience, updateExperience } from "@/app/actions/experience-actions"
import { deleteEducation, updateEducation } from "@/app/actions/education-actions"
import { deleteSkill, updateSkill } from "@/app/actions/skill-actions"
import { deleteProject, updateProject } from "@/app/actions/project-actions"
import { deleteCertification, updateCertification } from "@/app/actions/certification-actions"
import { deleteAward, updateAward } from "@/app/actions/award-actions"
import { deleteVolunteering, updateVolunteering } from "@/app/actions/volunteering-actions"
import { deletePublication, updatePublication } from "@/app/actions/publication-actions"
import { deleteLanguage, updateLanguage } from "@/app/actions/language-actions"
import type {
    AwardItem, CertificationItem, EducationItem, ExperienceItem, LanguageItem, ProjectItem, PublicationItem,
    SkillCategoryItem, VolunteeringItem,
} from "@/types/db"
import { formatDateRange, formatMonthYear, PRESENT } from "@/lib/dates"
import { kindMeta, type Tag } from "@/lib/tags/types"

interface SelectionDisplayProps {
    experiences: ExperienceItem[];
    educations: EducationItem[];
    skills: SkillCategoryItem[];
    projects: ProjectItem[];
    certifications: CertificationItem[];
    awards: AwardItem[];
    volunteering: VolunteeringItem[];
    publications: PublicationItem[];
    languages: LanguageItem[];
    /** Opens the resume import flow (shown in the empty state). */
    onImport?: () => void;
    /** Opens the Master Editor (shown in the empty state). */
    onEdit?: () => void;
    /** Item id -> names of saved variants that include it. */
    variantUsage?: Record<string, string[]>;
}

export default function SelectionDisplay({
    experiences, educations, skills, projects, certifications, awards, volunteering, publications, languages, onImport, onEdit, variantUsage = {},
}: SelectionDisplayProps) {
    const hasItems = [experiences, educations, skills, projects, certifications, awards, volunteering, publications, languages]
        .some(list => list.length > 0);

    if (!hasItems) {
        return (
            <div className="p-12 md:p-20 border-2 border-dashed border-black/5 rounded-[2.5rem] text-center bg-gray-50/50">
                <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <LibraryIcon className="w-8 h-8 text-black/20" />
                </div>
                <p className="text-black/40 font-bold text-xl tracking-tight">Your library is empty.</p>
                <p className="text-black/30 text-sm mt-1">Import an existing resume to fill it in seconds, or add items by hand in the Master Editor.</p>
                {(onImport || onEdit) && (
                    <div className="flex flex-wrap justify-center gap-3 mt-8">
                        {onImport && (
                            <button type="button" onClick={onImport} className="px-6 py-3.5 rounded-2xl bg-black text-white text-sm font-black uppercase tracking-widest shadow-lg shadow-black/10 hover:bg-black/80 transition-all active:scale-[0.98]">
                                Import Resume
                            </button>
                        )}
                        {onEdit && (
                            <button type="button" onClick={onEdit} className="px-6 py-3.5 rounded-2xl bg-white text-black border-2 border-black/10 hover:border-black text-sm font-black uppercase tracking-widest transition-all active:scale-[0.98]">
                                Master Editor
                            </button>
                        )}
                    </div>
                )}
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
                            tags={exp.tags}
                            usedBy={variantUsage[exp.id]}
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
                            tags={edu.tags}
                            usedBy={variantUsage[edu.id]}
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
                            tags={project.tags}
                            usedBy={variantUsage[project.id]}
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
                            tags={skill.tags}
                            usedBy={variantUsage[skill.id]}
                            title={skill.category}
                            body={skill.items}
                            isSelected={skill.isSelected}
                            onUpdate={updateSkill}
                            onDelete={deleteSkill}
                        />
                    ))}
                </LibrarySection>
            )}

            {volunteering.length > 0 && (
                <LibrarySection icon={<HeartIcon className="w-6 h-6 text-white" />} color="bg-rose-500 shadow-rose-500/10" title="Volunteering & Leadership" subtitle="Community, clubs & extracurriculars">
                    {volunteering.map((vol) => (
                        <SelectionCard
                            key={vol.id}
                            id={vol.id}
                            tags={vol.tags}
                            usedBy={variantUsage[vol.id]}
                            title={vol.role}
                            subtitle={vol.organization}
                            startDate={vol.startDate}
                            endDate={vol.endDate}
                            isActive={vol.isActive}
                            isSelected={vol.isSelected}
                            onUpdate={updateVolunteering}
                            onDelete={deleteVolunteering}
                            type="volunteering"
                        >
                            <BulletList items={vol.description} />
                        </SelectionCard>
                    ))}
                </LibrarySection>
            )}

            {publications.length > 0 && (
                <LibrarySection icon={<BookIcon className="w-6 h-6 text-white" />} color="bg-indigo-600 shadow-indigo-600/10" title="Publications" subtitle="Papers, articles & talks">
                    {publications.map((pub) => (
                        <SimpleCard
                            key={pub.id}
                            id={pub.id}
                            tags={pub.tags}
                            usedBy={variantUsage[pub.id]}
                            title={pub.title}
                            body={[pub.authors, pub.venue, formatMonthYear(pub.date)].filter(Boolean).join(" · ")}
                            isSelected={pub.isSelected}
                            onUpdate={updatePublication}
                            onDelete={deletePublication}
                        />
                    ))}
                </LibrarySection>
            )}

            {awards.length > 0 && (
                <LibrarySection icon={<TrophyIcon className="w-6 h-6 text-white" />} color="bg-orange-500 shadow-orange-500/10" title="Awards & Honors" subtitle="Scholarships, prizes & recognition">
                    {awards.map((award) => (
                        <SimpleCard
                            key={award.id}
                            id={award.id}
                            tags={award.tags}
                            usedBy={variantUsage[award.id]}
                            title={award.title}
                            body={[[award.issuer, formatMonthYear(award.date)].filter(Boolean).join(" · "), award.description].filter(Boolean).join("\n")}
                            isSelected={award.isSelected}
                            onUpdate={updateAward}
                            onDelete={deleteAward}
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
                            tags={cert.tags}
                            usedBy={variantUsage[cert.id]}
                            title={cert.name}
                            body={[cert.issuer, cert.year].filter(Boolean).join(" · ")}
                            isSelected={cert.isSelected}
                            onUpdate={updateCertification}
                            onDelete={deleteCertification}
                        />
                    ))}
                </LibrarySection>
            )}

            {languages.length > 0 && (
                <LibrarySection icon={<GlobeIcon className="w-6 h-6 text-white" />} color="bg-sky-600 shadow-sky-600/10" title="Languages" subtitle="Spoken languages & proficiency">
                    {languages.map((lang) => (
                        <SimpleCard
                            key={lang.id}
                            id={lang.id}
                            tags={lang.tags}
                            usedBy={variantUsage[lang.id]}
                            title={lang.language}
                            body={lang.proficiency ?? ""}
                            isSelected={lang.isSelected}
                            onUpdate={updateLanguage}
                            onDelete={deleteLanguage}
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
            ? "border-black ring-4 ring-black/5 shadow-2xl shadow-black/5"
            : "border-black/5 shadow-sm hover:shadow-xl hover:border-black/20"
    }`;

type ServerAction = (id: string, formData: FormData) => Promise<void>;

/** Submit button that disables itself while its form action is pending (prevents double toggles). */
function PendingButton({ className, title, children }: { className: string; title?: string; children: React.ReactNode }) {
    const { pending } = useFormStatus();
    return (
        <button type="submit" title={title} disabled={pending} aria-busy={pending} className={`${className} disabled:opacity-60 disabled:cursor-wait`}>
            {children}
        </button>
    );
}

function IncludeToggle({ id, isSelected, onUpdate }: { id: string; isSelected: boolean; onUpdate: ServerAction }) {
    return (
        <form action={onUpdate.bind(null, id)} className="w-full">
            <input type="hidden" name="isSelected" value={(!isSelected).toString()} />
            <PendingButton
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
            </PendingButton>
        </form>
    );
}

function DeleteButton({ id, onDelete }: { id: string; onDelete: (id: string) => Promise<void> }) {
    // z-20 keeps it above the black "selected" corner ribbon.
    return (
        <form action={onDelete.bind(null, id)} className="absolute top-5 right-5 z-20">
            <PendingButton title="Delete" className="bg-white/90 text-black/35 hover:text-red-500 p-2.5 hover:bg-red-50 rounded-full shadow-sm border border-black/5 transition-all active:scale-90 flex">
                <TrashIcon className="h-5 w-5" />
            </PendingButton>
        </form>
    );
}

const ACTIVE_LABEL = {
    experience: "Currently Here",
    education: "Active Student",
    project: "Ongoing",
    volunteering: "Currently Volunteering",
} as const;

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
    tags?: Tag[];
    usedBy?: string[];
    children?: React.ReactNode;
}

function SelectionCard({ id, title, subtitle, startDate, endDate, isActive, isSelected, onUpdate, onDelete, type, tags, usedBy, children }: SelectionCardProps) {
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

            <div className="flex-1 mb-6">{children}</div>
            <CardMeta tags={tags} usedBy={usedBy} />

            <div className="grid grid-cols-2 gap-3 pt-6 border-t border-black/5 mt-auto">
                <IncludeToggle id={id} isSelected={isSelected} onUpdate={onUpdate} />
                <form action={onUpdate.bind(null, id)} className="w-full">
                    <input type="hidden" name="isActive" value={(!isActive).toString()} />
                    <PendingButton
                        className={`w-full py-3.5 rounded-2xl text-[13px] font-black transition-all flex items-center justify-center gap-2 ${
                            isActive
                                ? "bg-blue-50 text-blue-600 border-2 border-blue-200"
                                : "bg-gray-50 text-black/30 border-2 border-transparent hover:bg-gray-100"
                        }`}
                    >
                        {isActive ? ACTIVE_LABEL[type] : "Mark Finished"}
                    </PendingButton>
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
    tags?: Tag[];
    usedBy?: string[];
}

function SimpleCard({ id, title, body, isSelected, onUpdate, onDelete, tags, usedBy }: SimpleCardProps) {
    return (
        <div className={cardClass(isSelected)}>
            <div className="flex justify-between items-start mb-6">
                <div className="space-y-1 pr-12">
                    <h3 className="font-black text-xl text-gray-900 leading-[1.1] tracking-tight">{title}</h3>
                </div>
                <DeleteButton id={id} onDelete={onDelete} />
            </div>

            <div className="flex-1 mb-6">
                {body && <p className="text-black/60 font-medium leading-relaxed whitespace-pre-line">{body}</p>}
            </div>
            <CardMeta tags={tags} usedBy={usedBy} />

            <div className="pt-6 border-t border-black/5 mt-auto">
                <IncludeToggle id={id} isSelected={isSelected} onUpdate={onUpdate} />
            </div>

            {isSelected && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-black pointer-events-none transform rotate-45 translate-x-12 -translate-y-12"></div>
            )}
        </div>
    )
}

/** Smart-tag chips and the "used in N variants" badge shown under a card body. */
function CardMeta({ tags = [], usedBy = [] }: { tags?: Tag[]; usedBy?: string[] }) {
    if (tags.length === 0 && usedBy.length === 0) return null;
    const shown = tags.slice(0, 6);
    return (
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
            {usedBy.length > 0 && (
                <span title={usedBy.join(", ")} className="px-2 py-0.5 rounded-md bg-black text-white text-[10px] font-black uppercase tracking-widest mr-1">
                    {usedBy.length} {usedBy.length === 1 ? "variant" : "variants"}
                </span>
            )}
            {shown.map(t => (
                <span key={t.name} className="px-2 py-0.5 rounded-md text-[10px] font-bold border" style={{ color: kindMeta(t.kind).color, borderColor: `${kindMeta(t.kind).color}55`, background: `${kindMeta(t.kind).color}12` }}>
                    {t.display}
                </span>
            ))}
            {tags.length > shown.length && <span className="text-[10px] font-black text-black/30">+{tags.length - shown.length}</span>}
        </div>
    );
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

function HeartIcon({ className }: { className?: string }) {
    return (
        <svg {...iconProps} className={className}>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>
    );
}

function BookIcon({ className }: { className?: string }) {
    return (
        <svg {...iconProps} className={className}>
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
        </svg>
    );
}

function TrophyIcon({ className }: { className?: string }) {
    return (
        <svg {...iconProps} className={className}>
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
            <path d="M4 22h16"></path>
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"></path>
        </svg>
    );
}

function GlobeIcon({ className }: { className?: string }) {
    return (
        <svg {...iconProps} className={className}>
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
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
