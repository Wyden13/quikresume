"use client";

import React, { useState } from "react";
import Link from "next/link";
import type {
    Award, Certification, Education, Language, Project, Publication, ResumeData, ResumeListKey, SkillCategory,
    Volunteering, WorkExperience,
} from "@/types/schema";
import { deleteEducation } from "@/app/actions/education-actions";
import { deleteExperience } from "@/app/actions/experience-actions";
import { deleteSkill } from "@/app/actions/skill-actions";
import { deleteProject } from "@/app/actions/project-actions";
import { deleteCertification } from "@/app/actions/certification-actions";
import { deleteAward } from "@/app/actions/award-actions";
import { deleteVolunteering } from "@/app/actions/volunteering-actions";
import { deletePublication } from "@/app/actions/publication-actions";
import { deleteLanguage } from "@/app/actions/language-actions";
import { isTempId, newTempId } from "@/lib/ids";
import { isStale } from "@/lib/tags/content";
import { PRESENT } from "@/lib/dates";
import { Button, Input, Label, Textarea } from "@/components/ui/form-controls";

const Plus = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
);

const Trash2 = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
    </svg>
);

const Save = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
        <polyline points="17 21 17 13 7 13 7 21"></polyline>
        <polyline points="7 3 7 8 15 8"></polyline>
    </svg>
);

// --- SECTION SCAFFOLDING ---

function SectionHeading({ index, title, action }: { index: string; title: string; action?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                    <span className="text-white text-[10px] font-black tracking-tighter">{index}</span>
                </div>
                <h2 className="text-xl font-black tracking-tight uppercase">{title}</h2>
            </div>
            {action}
        </div>
    );
}

function ItemCard({ onRemove, isSelected, onToggle, toggleHint, badges, children }: {
    onRemove: () => void;
    isSelected: boolean;
    onToggle: (checked: boolean) => void;
    toggleHint: string;
    badges?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="p-8 border-2 border-black/5 bg-gray-50/30 rounded-[2rem] space-y-6 relative group transition-all hover:bg-white hover:border-black/10 hover:shadow-2xl hover:shadow-black/5">
            {badges && <div className="flex flex-wrap gap-2 pr-12">{badges}</div>}
            <Button
                variant="ghost"
                size="sm"
                onClick={onRemove}
                title="Delete"
                className="absolute top-4 right-4 text-black/25 hover:text-red-500 hover:bg-red-50"
            >
                <Trash2 className="size-4" />
            </Button>
            <div className="space-y-6">
                <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-black/5">
                    <div className="flex flex-col">
                        <span className="text-sm font-black uppercase tracking-tight">Include on Resume</span>
                        <span className="text-[10px] text-black/40 font-bold uppercase tracking-widest">{toggleHint}</span>
                    </div>
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onToggle(e.target.checked)}
                        className="w-6 h-6 accent-black cursor-pointer"
                    />
                </div>
                {children}
            </div>
        </div>
    );
}

/** Start date + end date, with a "current" checkbox that stores endDate as "Present". */
function DateRangeFields({ idPrefix, startDate, endDate, currentLabel, onChange }: {
    idPrefix: string;
    startDate: string;
    endDate: string;
    currentLabel: string;
    onChange: (patch: { startDate?: string; endDate?: string }) => void;
}) {
    const isCurrent = endDate === PRESENT;
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
                <Label htmlFor={`${idPrefix}-start`}>Start Date</Label>
                <Input id={`${idPrefix}-start`} type="date" value={startDate} onChange={(e) => onChange({ startDate: e.target.value })} />
            </div>
            <div>
                <Label htmlFor={`${idPrefix}-end`}>End Date</Label>
                <Input
                    id={`${idPrefix}-end`}
                    type="date"
                    value={isCurrent ? "" : endDate}
                    disabled={isCurrent}
                    onChange={(e) => onChange({ endDate: e.target.value })}
                />
            </div>
            <div className="flex items-end">
                <label className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-black/5 cursor-pointer w-full">
                    <input
                        type="checkbox"
                        checked={isCurrent}
                        onChange={(e) => onChange({ endDate: e.target.checked ? PRESENT : "" })}
                        className="w-5 h-5 accent-black cursor-pointer"
                    />
                    <span className="text-sm font-black uppercase tracking-tight">{currentLabel}</span>
                </label>
            </div>
        </div>
    );
}

// --- FORM ---

type ListKey = ResumeListKey;
type ItemOf<K extends ListKey> = ResumeData[K][number];

/** Stable DOM id for a list-item field so labels can point at their inputs. */
const fid = (itemId: string, field: string) => `${itemId}-${field}`;

interface ResumeFormProps {
    /** Item id -> names of saved variants that include it (for the "Used in N variants" badge). */
    variantUsage?: Record<string, string[]>;
    resumeData: ResumeData;
    /** Functional updater so edits never depend on a stale snapshot. */
    onChange: (updater: (prev: ResumeData) => ResumeData) => void;
    onSaveAndExit: () => void;
    isSaving: boolean;
}

export function ResumeForm({ resumeData, onChange, onSaveAndExit, isSaving, variantUsage = {} }: ResumeFormProps) {
    const badgesFor = <K extends ListKey>(key: K, item: ItemOf<K>) => {
        const used = variantUsage[item.id] ?? [];
        const stale = isStale(key, item as ResumeData[K][number]);
        if (used.length === 0 && !stale) return null;
        return (
            <>
                {used.length > 0 && (
                    <span title={used.join(", ")} className="px-2 py-1 rounded-md bg-black text-white text-[10px] font-black uppercase tracking-widest">
                        Used in {used.length} {used.length === 1 ? "variant" : "variants"}
                    </span>
                )}
                {stale && (
                    <span title="Skills will be analysed when you save" className="px-2 py-1 rounded-md bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-widest">
                        Not analysed
                    </span>
                )}
            </>
        );
    };
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const updatePersonalInfo = (field: keyof ResumeData["personalInfo"], value: string) => {
        onChange(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, [field]: value } }));
    };

    const addItem = <K extends ListKey>(key: K, item: ItemOf<K>) => {
        onChange(prev => ({ ...prev, [key]: [...prev[key], item] }));
    };

    const updateItem = <K extends ListKey>(key: K, id: string, patch: Partial<ItemOf<K>>) => {
        onChange(prev => ({
            ...prev,
            [key]: (prev[key] as ItemOf<K>[]).map(item => (item.id === id ? { ...item, ...patch } : item)),
        }));
    };

    // Deletion is immediate for persisted items; adds/edits persist on Save & Exit.
    const removeItem = async <K extends ListKey>(key: K, id: string, deleteAction: (id: string) => Promise<void>) => {
        if (!isTempId(id)) {
            try {
                await deleteAction(id);
                setDeleteError(null);
            } catch (err) {
                console.error("Failed to delete item:", err);
                setDeleteError("Could not delete this item. Please try again.");
                return;
            }
        }
        onChange(prev => ({ ...prev, [key]: (prev[key] as ItemOf<K>[]).filter(item => item.id !== id) }));
    };

    const newExperience = (): WorkExperience => ({ id: newTempId(), title: "", company: "", startDate: "", endDate: "", description: "", isSelected: true, tags: [], tagsHash: null });
    const newEducation = (): Education => ({ id: newTempId(), degree: "", institution: "", startDate: "", endDate: "", gpa: "", minor: "", details: "", isSelected: true, tags: [], tagsHash: null });
    const newSkill = (): SkillCategory => ({ id: newTempId(), category: "", items: "", isSelected: true, tags: [], tagsHash: null });
    const newProject = (): Project => ({ id: newTempId(), title: "", stack: "", link: "", startDate: "", endDate: "", description: "", isSelected: true, tags: [], tagsHash: null });
    const newCertification = (): Certification => ({ id: newTempId(), name: "", issuer: "", year: "", isSelected: true, tags: [], tagsHash: null });
    const newAward = (): Award => ({ id: newTempId(), title: "", issuer: "", date: "", description: "", isSelected: true, tags: [], tagsHash: null });
    const newVolunteering = (): Volunteering => ({ id: newTempId(), role: "", organization: "", startDate: "", endDate: "", description: "", isSelected: true, tags: [], tagsHash: null });
    const newPublication = (): Publication => ({ id: newTempId(), title: "", venue: "", date: "", link: "", authors: "", isSelected: true, tags: [], tagsHash: null });
    const newLanguage = (): Language => ({ id: newTempId(), language: "", proficiency: "", isSelected: true, tags: [], tagsHash: null });

    const addButton = (label: string, onClick: () => void) => (
        <Button onClick={onClick} size="sm" variant="default">
            <Plus className="size-3 mr-2" />
            {label}
        </Button>
    );

    const p = resumeData.personalInfo;

    return (
        <div className="p-6 md:p-8 space-y-12 bg-white">
            {deleteError && (
                <div role="alert" className="border-2 border-red-200 bg-red-50 rounded-2xl p-5 text-red-800 text-sm font-bold">
                    {deleteError}
                </div>
            )}

            {/* Personal Information */}
            <section className="space-y-6">
                <SectionHeading index="01" title="Personal Information" />
                <p className="text-sm text-black/50 font-medium -mt-2">
                    These details are also editable on your{" "}
                    <Link href="/dashboard/profile" className="font-bold text-black underline underline-offset-4">Profile</Link> page.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <Label htmlFor="firstName">First Name</Label>
                        <Input id="firstName" value={p.firstName} onChange={(e) => updatePersonalInfo("firstName", e.target.value)} placeholder="Alex" />
                    </div>
                    <div>
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input id="lastName" value={p.lastName} onChange={(e) => updatePersonalInfo("lastName", e.target.value)} placeholder="Morgan" />
                    </div>
                    <div className="col-span-full">
                        <Label htmlFor="headline">Headline</Label>
                        <Input id="headline" value={p.headline} onChange={(e) => updatePersonalInfo("headline", e.target.value)} placeholder="B.S. Computer Science, Class of 2026 · Software · AI/ML" />
                    </div>
                    <div>
                        <Label htmlFor="email">Professional Email</Label>
                        <Input id="email" type="email" value={p.email} onChange={(e) => updatePersonalInfo("email", e.target.value)} placeholder="alex@example.com" />
                    </div>
                    <div>
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input id="phone" value={p.phone} onChange={(e) => updatePersonalInfo("phone", e.target.value)} placeholder="(123) 456-7890" />
                    </div>
                    <div className="col-span-full">
                        <Label htmlFor="location">Location</Label>
                        <Input id="location" value={p.location} onChange={(e) => updatePersonalInfo("location", e.target.value)} placeholder="Seattle, WA" />
                    </div>
                    <div>
                        <Label htmlFor="github">GitHub</Label>
                        <Input id="github" value={p.github} onChange={(e) => updatePersonalInfo("github", e.target.value)} placeholder="github.com/alexmorgan" />
                    </div>
                    <div>
                        <Label htmlFor="linkedin">LinkedIn</Label>
                        <Input id="linkedin" value={p.linkedin} onChange={(e) => updatePersonalInfo("linkedin", e.target.value)} placeholder="linkedin.com/in/alexmorgan" />
                    </div>
                    <div className="col-span-full">
                        <Label htmlFor="website">Website</Label>
                        <Input id="website" value={p.website} onChange={(e) => updatePersonalInfo("website", e.target.value)} placeholder="alexmorgan.dev" />
                    </div>
                    <div className="col-span-full">
                        <Label htmlFor="summary">Professional Summary</Label>
                        <Textarea id="summary" value={p.summary} onChange={(e) => updatePersonalInfo("summary", e.target.value)} placeholder="Brief overview of your professional background and goals..." rows={5} />
                    </div>
                </div>
            </section>

            {/* Work Experience */}
            <section className="space-y-8">
                <SectionHeading index="02" title="Work Experience" action={addButton("Add New", () => addItem("workExperience", newExperience()))} />
                <div className="space-y-6">
                    {resumeData.workExperience.map((exp) => (
                        <ItemCard
                            key={exp.id}
                            badges={badgesFor("workExperience", exp)}
                            isSelected={exp.isSelected}
                            onToggle={(checked) => updateItem("workExperience", exp.id, { isSelected: checked })}
                            onRemove={() => removeItem("workExperience", exp.id, deleteExperience)}
                            toggleHint="Toggle visibility for this role"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <Label htmlFor={fid(exp.id, "title")}>Position</Label>
                                    <Input id={fid(exp.id, "title")} value={exp.title} onChange={(e) => updateItem("workExperience", exp.id, { title: e.target.value })} placeholder="Senior Software Engineer" />
                                </div>
                                <div>
                                    <Label htmlFor={fid(exp.id, "company")}>Company</Label>
                                    <Input id={fid(exp.id, "company")} value={exp.company} onChange={(e) => updateItem("workExperience", exp.id, { company: e.target.value })} placeholder="Tech Corp" />
                                </div>
                            </div>
                            <DateRangeFields
                                idPrefix={exp.id}
                                startDate={exp.startDate}
                                endDate={exp.endDate}
                                currentLabel="I work here now"
                                onChange={(patch) => updateItem("workExperience", exp.id, patch)}
                            />
                            <div>
                                <Label htmlFor={fid(exp.id, "description")}>Responsibilities (one per line)</Label>
                                <Textarea id={fid(exp.id, "description")} value={exp.description} onChange={(e) => updateItem("workExperience", exp.id, { description: e.target.value })} placeholder="Enter your key achievements, one per line..." rows={4} />
                            </div>
                        </ItemCard>
                    ))}
                </div>
            </section>

            {/* Education */}
            <section className="space-y-8">
                <SectionHeading index="03" title="Academic History" action={addButton("Add New", () => addItem("education", newEducation()))} />
                <div className="space-y-6">
                    {resumeData.education.map((edu) => (
                        <ItemCard
                            key={edu.id}
                            badges={badgesFor("education", edu)}
                            isSelected={edu.isSelected}
                            onToggle={(checked) => updateItem("education", edu.id, { isSelected: checked })}
                            onRemove={() => removeItem("education", edu.id, deleteEducation)}
                            toggleHint="Toggle visibility for this education"
                        >
                            <div>
                                <Label htmlFor={fid(edu.id, "degree")}>Degree / Program</Label>
                                <Input id={fid(edu.id, "degree")} value={edu.degree} onChange={(e) => updateItem("education", edu.id, { degree: e.target.value })} placeholder="B.S. in Computer Science" />
                            </div>
                            <div>
                                <Label htmlFor={fid(edu.id, "institution")}>Institution</Label>
                                <Input id={fid(edu.id, "institution")} value={edu.institution} onChange={(e) => updateItem("education", edu.id, { institution: e.target.value })} placeholder="State University" />
                            </div>
                            <DateRangeFields
                                idPrefix={edu.id}
                                startDate={edu.startDate}
                                endDate={edu.endDate}
                                currentLabel="Currently enrolled"
                                onChange={(patch) => updateItem("education", edu.id, patch)}
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <Label htmlFor={fid(edu.id, "gpa")}>GPA (Optional)</Label>
                                    <Input id={fid(edu.id, "gpa")} value={edu.gpa} onChange={(e) => updateItem("education", edu.id, { gpa: e.target.value })} placeholder="3.8 / 4.0" />
                                </div>
                                <div>
                                    <Label htmlFor={fid(edu.id, "minor")}>Minor (Optional)</Label>
                                    <Input id={fid(edu.id, "minor")} value={edu.minor} onChange={(e) => updateItem("education", edu.id, { minor: e.target.value })} placeholder="Statistics" />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor={fid(edu.id, "details")}>Honors / Coursework (Optional)</Label>
                                <Textarea id={fid(edu.id, "details")} value={edu.details} onChange={(e) => updateItem("education", edu.id, { details: e.target.value })} placeholder="Dean's List. Coursework: Distributed Systems, Machine Learning..." rows={2} />
                            </div>
                        </ItemCard>
                    ))}
                </div>
            </section>

            {/* Skills */}
            <section className="space-y-8">
                <SectionHeading index="04" title="Skill Categories" action={addButton("Add Category", () => addItem("skills", newSkill()))} />
                <div className="space-y-6">
                    {resumeData.skills.map((skill) => (
                        <ItemCard
                            key={skill.id}
                            badges={badgesFor("skills", skill)}
                            isSelected={skill.isSelected}
                            onToggle={(checked) => updateItem("skills", skill.id, { isSelected: checked })}
                            onRemove={() => removeItem("skills", skill.id, deleteSkill)}
                            toggleHint="Toggle visibility for this skill category"
                        >
                            <div>
                                <Label htmlFor={fid(skill.id, "category")}>Category Name</Label>
                                <Input id={fid(skill.id, "category")} value={skill.category} onChange={(e) => updateItem("skills", skill.id, { category: e.target.value })} placeholder="Languages" />
                            </div>
                            <div>
                                <Label htmlFor={fid(skill.id, "items")}>Skills (Comma Separated)</Label>
                                <Input id={fid(skill.id, "items")} value={skill.items} onChange={(e) => updateItem("skills", skill.id, { items: e.target.value })} placeholder="Python, Java, TypeScript, Go, SQL" />
                            </div>
                        </ItemCard>
                    ))}
                </div>
            </section>

            {/* Projects */}
            <section className="space-y-8">
                <SectionHeading index="05" title="Projects" action={addButton("Add Project", () => addItem("projects", newProject()))} />
                <div className="space-y-6">
                    {resumeData.projects.map((project) => (
                        <ItemCard
                            key={project.id}
                            badges={badgesFor("projects", project)}
                            isSelected={project.isSelected}
                            onToggle={(checked) => updateItem("projects", project.id, { isSelected: checked })}
                            onRemove={() => removeItem("projects", project.id, deleteProject)}
                            toggleHint="Toggle visibility for this project"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <Label htmlFor={fid(project.id, "title")}>Title</Label>
                                    <Input id={fid(project.id, "title")} value={project.title} onChange={(e) => updateItem("projects", project.id, { title: e.target.value })} placeholder="Support Ticket Classifier" />
                                </div>
                                <div>
                                    <Label htmlFor={fid(project.id, "link")}>Link (Optional)</Label>
                                    <Input id={fid(project.id, "link")} value={project.link} onChange={(e) => updateItem("projects", project.id, { link: e.target.value })} placeholder="github.com/you/project" />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor={fid(project.id, "stack")}>Tech Stack</Label>
                                <Input id={fid(project.id, "stack")} value={project.stack} onChange={(e) => updateItem("projects", project.id, { stack: e.target.value })} placeholder="PyTorch, FastAPI, Docker, AWS Lambda" />
                            </div>
                            <DateRangeFields
                                idPrefix={project.id}
                                startDate={project.startDate}
                                endDate={project.endDate}
                                currentLabel="Ongoing"
                                onChange={(patch) => updateItem("projects", project.id, patch)}
                            />
                            <div>
                                <Label htmlFor={fid(project.id, "description")}>Highlights (one per line)</Label>
                                <Textarea id={fid(project.id, "description")} value={project.description} onChange={(e) => updateItem("projects", project.id, { description: e.target.value })} placeholder="What you built, with a number. Impact or scale." rows={4} />
                            </div>
                        </ItemCard>
                    ))}
                </div>
            </section>

            {/* Certifications */}
            <section className="space-y-8">
                <SectionHeading index="06" title="Certifications" action={addButton("Add Certification", () => addItem("certifications", newCertification()))} />
                <div className="space-y-6">
                    {resumeData.certifications.map((cert) => (
                        <ItemCard
                            key={cert.id}
                            badges={badgesFor("certifications", cert)}
                            isSelected={cert.isSelected}
                            onToggle={(checked) => updateItem("certifications", cert.id, { isSelected: checked })}
                            onRemove={() => removeItem("certifications", cert.id, deleteCertification)}
                            toggleHint="Toggle visibility for this certification"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-2">
                                    <Label htmlFor={fid(cert.id, "name")}>Name</Label>
                                    <Input id={fid(cert.id, "name")} value={cert.name} onChange={(e) => updateItem("certifications", cert.id, { name: e.target.value })} placeholder="AWS Certified Cloud Practitioner" />
                                </div>
                                <div>
                                    <Label htmlFor={fid(cert.id, "year")}>Year</Label>
                                    <Input id={fid(cert.id, "year")} value={cert.year} onChange={(e) => updateItem("certifications", cert.id, { year: e.target.value })} placeholder="2025" />
                                </div>
                                <div className="md:col-span-3">
                                    <Label htmlFor={fid(cert.id, "issuer")}>Issuer (Optional)</Label>
                                    <Input id={fid(cert.id, "issuer")} value={cert.issuer} onChange={(e) => updateItem("certifications", cert.id, { issuer: e.target.value })} placeholder="Amazon Web Services" />
                                </div>
                            </div>
                        </ItemCard>
                    ))}
                </div>
            </section>

            {/* Volunteering & Leadership */}
            <section className="space-y-8">
                <SectionHeading index="07" title="Volunteering & Leadership" action={addButton("Add New", () => addItem("volunteering", newVolunteering()))} />
                <div className="space-y-6">
                    {resumeData.volunteering.map((vol) => (
                        <ItemCard
                            key={vol.id}
                            badges={badgesFor("volunteering", vol)}
                            isSelected={vol.isSelected}
                            onToggle={(checked) => updateItem("volunteering", vol.id, { isSelected: checked })}
                            onRemove={() => removeItem("volunteering", vol.id, deleteVolunteering)}
                            toggleHint="Toggle visibility for this activity"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <Label htmlFor={fid(vol.id, "role")}>Role</Label>
                                    <Input id={fid(vol.id, "role")} value={vol.role} onChange={(e) => updateItem("volunteering", vol.id, { role: e.target.value })} placeholder="Coding Mentor" />
                                </div>
                                <div>
                                    <Label htmlFor={fid(vol.id, "organization")}>Organization</Label>
                                    <Input id={fid(vol.id, "organization")} value={vol.organization} onChange={(e) => updateItem("volunteering", vol.id, { organization: e.target.value })} placeholder="Girls Who Code" />
                                </div>
                            </div>
                            <DateRangeFields
                                idPrefix={vol.id}
                                startDate={vol.startDate}
                                endDate={vol.endDate}
                                currentLabel="Still involved"
                                onChange={(patch) => updateItem("volunteering", vol.id, patch)}
                            />
                            <div>
                                <Label htmlFor={fid(vol.id, "description")}>Highlights (one per line)</Label>
                                <Textarea id={fid(vol.id, "description")} value={vol.description} onChange={(e) => updateItem("volunteering", vol.id, { description: e.target.value })} placeholder="What you did and the impact, one per line..." rows={3} />
                            </div>
                        </ItemCard>
                    ))}
                </div>
            </section>

            {/* Publications */}
            <section className="space-y-8">
                <SectionHeading index="08" title="Publications" action={addButton("Add Publication", () => addItem("publications", newPublication()))} />
                <div className="space-y-6">
                    {resumeData.publications.map((pub) => (
                        <ItemCard
                            key={pub.id}
                            badges={badgesFor("publications", pub)}
                            isSelected={pub.isSelected}
                            onToggle={(checked) => updateItem("publications", pub.id, { isSelected: checked })}
                            onRemove={() => removeItem("publications", pub.id, deletePublication)}
                            toggleHint="Toggle visibility for this publication"
                        >
                            <div>
                                <Label htmlFor={fid(pub.id, "title")}>Title</Label>
                                <Input id={fid(pub.id, "title")} value={pub.title} onChange={(e) => updateItem("publications", pub.id, { title: e.target.value })} placeholder="Efficient Tracing at Scale" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-2">
                                    <Label htmlFor={fid(pub.id, "venue")}>Venue / Publisher</Label>
                                    <Input id={fid(pub.id, "venue")} value={pub.venue} onChange={(e) => updateItem("publications", pub.id, { venue: e.target.value })} placeholder="USENIX ATC" />
                                </div>
                                <div>
                                    <Label htmlFor={fid(pub.id, "date")}>Date</Label>
                                    <Input id={fid(pub.id, "date")} type="date" value={pub.date} onChange={(e) => updateItem("publications", pub.id, { date: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <Label htmlFor={fid(pub.id, "authors")}>Authors (Optional)</Label>
                                    <Input id={fid(pub.id, "authors")} value={pub.authors} onChange={(e) => updateItem("publications", pub.id, { authors: e.target.value })} placeholder="A. Morgan, J. Doe" />
                                </div>
                                <div>
                                    <Label htmlFor={fid(pub.id, "link")}>Link (Optional)</Label>
                                    <Input id={fid(pub.id, "link")} value={pub.link} onChange={(e) => updateItem("publications", pub.id, { link: e.target.value })} placeholder="doi.org/10.1000/xyz" />
                                </div>
                            </div>
                        </ItemCard>
                    ))}
                </div>
            </section>

            {/* Awards */}
            <section className="space-y-8">
                <SectionHeading index="09" title="Awards & Honors" action={addButton("Add Award", () => addItem("awards", newAward()))} />
                <div className="space-y-6">
                    {resumeData.awards.map((award) => (
                        <ItemCard
                            key={award.id}
                            badges={badgesFor("awards", award)}
                            isSelected={award.isSelected}
                            onToggle={(checked) => updateItem("awards", award.id, { isSelected: checked })}
                            onRemove={() => removeItem("awards", award.id, deleteAward)}
                            toggleHint="Toggle visibility for this award"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-2">
                                    <Label htmlFor={fid(award.id, "title")}>Title</Label>
                                    <Input id={fid(award.id, "title")} value={award.title} onChange={(e) => updateItem("awards", award.id, { title: e.target.value })} placeholder="Dean's List" />
                                </div>
                                <div>
                                    <Label htmlFor={fid(award.id, "date")}>Date</Label>
                                    <Input id={fid(award.id, "date")} type="date" value={award.date} onChange={(e) => updateItem("awards", award.id, { date: e.target.value })} />
                                </div>
                                <div className="md:col-span-3">
                                    <Label htmlFor={fid(award.id, "issuer")}>Issuer (Optional)</Label>
                                    <Input id={fid(award.id, "issuer")} value={award.issuer} onChange={(e) => updateItem("awards", award.id, { issuer: e.target.value })} placeholder="State University" />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor={fid(award.id, "description")}>Description (Optional)</Label>
                                <Textarea id={fid(award.id, "description")} value={award.description} onChange={(e) => updateItem("awards", award.id, { description: e.target.value })} placeholder="Top 5% of the class, 3 semesters running." rows={2} />
                            </div>
                        </ItemCard>
                    ))}
                </div>
            </section>

            {/* Languages */}
            <section className="space-y-8">
                <SectionHeading index="10" title="Languages" action={addButton("Add Language", () => addItem("languages", newLanguage()))} />
                <div className="space-y-6">
                    {resumeData.languages.map((lang) => (
                        <ItemCard
                            key={lang.id}
                            badges={badgesFor("languages", lang)}
                            isSelected={lang.isSelected}
                            onToggle={(checked) => updateItem("languages", lang.id, { isSelected: checked })}
                            onRemove={() => removeItem("languages", lang.id, deleteLanguage)}
                            toggleHint="Toggle visibility for this language"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <Label htmlFor={fid(lang.id, "language")}>Language</Label>
                                    <Input id={fid(lang.id, "language")} value={lang.language} onChange={(e) => updateItem("languages", lang.id, { language: e.target.value })} placeholder="French" />
                                </div>
                                <div>
                                    <Label htmlFor={fid(lang.id, "proficiency")}>Proficiency (Optional)</Label>
                                    <Input id={fid(lang.id, "proficiency")} value={lang.proficiency} onChange={(e) => updateItem("languages", lang.id, { proficiency: e.target.value })} placeholder="Native / Fluent / B2" />
                                </div>
                            </div>
                        </ItemCard>
                    ))}
                </div>
            </section>

            {/* Bottom Save Action */}
            <div className="pt-8 border-t border-black/5 mt-12 flex justify-end">
                <Button
                    onClick={onSaveAndExit}
                    variant="primary"
                    size="lg"
                    loading={isSaving}
                    className="w-full md:w-auto shadow-xl shadow-black/20"
                >
                    <Save className="w-5 h-5 mr-2" />
                    Save & Exit
                </Button>
            </div>
        </div>
    );
}
