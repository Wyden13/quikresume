"use client";

import React from "react";
import type { Certification, Education, Project, ResumeData, SkillCategory, WorkExperience } from "@/types/schema";
import { deleteEducation } from "@/app/actions/education-actions";
import { deleteExperience } from "@/app/actions/experience-actions";
import { deleteSkill } from "@/app/actions/skill-actions";
import { deleteProject } from "@/app/actions/project-actions";
import { deleteCertification } from "@/app/actions/certification-actions";
import { isTempId, newTempId } from "@/lib/ids";
import { PRESENT } from "@/lib/dates";

// --- LOCAL UI COMPONENTS (Styled with Tailwind) ---
const Label = ({ children, htmlFor, className = "" }: { children: React.ReactNode; htmlFor?: string; className?: string }) => (
    <label htmlFor={htmlFor} className={`block text-sm font-black text-black/40 mb-1.5 uppercase tracking-widest ${className}`}>
        {children}
    </label>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
        {...props}
        className={`w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-black outline-none transition-all font-medium disabled:opacity-40 ${props.className || ""}`}
    />
);

const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea
        {...props}
        className={`w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-black outline-none transition-all font-medium resize-none ${props.className || ""}`}
    />
);

const Button = ({ children, onClick, variant = "default", size = "md", className = "", disabled = false, loading = false, title }: { children: React.ReactNode; onClick?: () => void; variant?: "default" | "ghost" | "primary"; size?: "sm" | "md" | "lg"; className?: string; disabled?: boolean; loading?: boolean; title?: string }) => {
    const base = "inline-flex items-center justify-center font-black transition-all rounded-2xl active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100";
    const variants = {
        default: "bg-white text-black border-2 border-black/10 hover:border-black hover:bg-black/5",
        ghost: "bg-transparent text-black/40 hover:bg-black/5 hover:text-black",
        primary: "bg-black text-white hover:bg-black/80 shadow-lg shadow-black/10",
    };
    const sizes = {
        sm: "px-4 py-2 text-xs uppercase tracking-widest",
        md: "px-6 py-3.5 text-sm uppercase tracking-widest",
        lg: "px-8 py-4 text-base uppercase tracking-widest",
    };
    return (
        <button type="button" onClick={onClick} disabled={disabled || loading} title={title} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
            {loading ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
            ) : null}
            {children}
        </button>
    );
};

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

function ItemCard({ onRemove, isSelected, onToggle, toggleHint, children }: {
    onRemove: () => void;
    isSelected: boolean;
    onToggle: (checked: boolean) => void;
    toggleHint: string;
    children: React.ReactNode;
}) {
    return (
        <div className="p-8 border-2 border-black/5 bg-gray-50/30 rounded-[2rem] space-y-6 relative group transition-all hover:bg-white hover:border-black/10 hover:shadow-2xl hover:shadow-black/5">
            <Button
                variant="ghost"
                size="sm"
                onClick={onRemove}
                title="Delete"
                className="absolute top-4 right-4 text-black/10 hover:text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
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
function DateRangeFields({ startDate, endDate, currentLabel, onChange }: {
    startDate: string;
    endDate: string;
    currentLabel: string;
    onChange: (patch: { startDate?: string; endDate?: string }) => void;
}) {
    const isCurrent = endDate === PRESENT;
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
                <Label>Start Date</Label>
                <Input type="date" value={startDate} onChange={(e) => onChange({ startDate: e.target.value })} />
            </div>
            <div>
                <Label>End Date</Label>
                <Input
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

type ListKey = "workExperience" | "education" | "skills" | "projects" | "certifications";
type ItemOf<K extends ListKey> = ResumeData[K][number];

interface ResumeFormProps {
    resumeData: ResumeData;
    /** Functional updater so edits never depend on a stale snapshot. */
    onChange: (updater: (prev: ResumeData) => ResumeData) => void;
    onSaveAndExit: () => void;
    isSaving: boolean;
}

export function ResumeForm({ resumeData, onChange, onSaveAndExit, isSaving }: ResumeFormProps) {
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
            } catch (err) {
                console.error("Failed to delete item:", err);
                alert("Could not delete this item. Please try again.");
                return;
            }
        }
        onChange(prev => ({ ...prev, [key]: (prev[key] as ItemOf<K>[]).filter(item => item.id !== id) }));
    };

    const newExperience = (): WorkExperience => ({ id: newTempId(), title: "", company: "", startDate: "", endDate: "", description: "", isSelected: true });
    const newEducation = (): Education => ({ id: newTempId(), degree: "", institution: "", startDate: "", endDate: "", gpa: "", minor: "", details: "", isSelected: true });
    const newSkill = (): SkillCategory => ({ id: newTempId(), category: "", items: "", isSelected: true });
    const newProject = (): Project => ({ id: newTempId(), title: "", stack: "", link: "", startDate: "", endDate: "", description: "", isSelected: true });
    const newCertification = (): Certification => ({ id: newTempId(), name: "", issuer: "", year: "", isSelected: true });

    const addButton = (label: string, onClick: () => void) => (
        <Button onClick={onClick} size="sm" variant="default">
            <Plus className="size-3 mr-2" />
            {label}
        </Button>
    );

    const p = resumeData.personalInfo;

    return (
        <div className="h-full overflow-y-auto p-8 space-y-12 bg-white">
            {/* Personal Information */}
            <section className="space-y-6">
                <SectionHeading index="01" title="Personal Information" />
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
                            isSelected={exp.isSelected}
                            onToggle={(checked) => updateItem("workExperience", exp.id, { isSelected: checked })}
                            onRemove={() => removeItem("workExperience", exp.id, deleteExperience)}
                            toggleHint="Toggle visibility for this role"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <Label>Position</Label>
                                    <Input value={exp.title} onChange={(e) => updateItem("workExperience", exp.id, { title: e.target.value })} placeholder="Senior Software Engineer" />
                                </div>
                                <div>
                                    <Label>Company</Label>
                                    <Input value={exp.company} onChange={(e) => updateItem("workExperience", exp.id, { company: e.target.value })} placeholder="Tech Corp" />
                                </div>
                            </div>
                            <DateRangeFields
                                startDate={exp.startDate}
                                endDate={exp.endDate}
                                currentLabel="I work here now"
                                onChange={(patch) => updateItem("workExperience", exp.id, patch)}
                            />
                            <div>
                                <Label>Responsibilities (one per line)</Label>
                                <Textarea value={exp.description} onChange={(e) => updateItem("workExperience", exp.id, { description: e.target.value })} placeholder="Enter your key achievements, one per line..." rows={4} />
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
                            isSelected={edu.isSelected}
                            onToggle={(checked) => updateItem("education", edu.id, { isSelected: checked })}
                            onRemove={() => removeItem("education", edu.id, deleteEducation)}
                            toggleHint="Toggle visibility for this education"
                        >
                            <div>
                                <Label>Degree / Program</Label>
                                <Input value={edu.degree} onChange={(e) => updateItem("education", edu.id, { degree: e.target.value })} placeholder="B.S. in Computer Science" />
                            </div>
                            <div>
                                <Label>Institution</Label>
                                <Input value={edu.institution} onChange={(e) => updateItem("education", edu.id, { institution: e.target.value })} placeholder="State University" />
                            </div>
                            <DateRangeFields
                                startDate={edu.startDate}
                                endDate={edu.endDate}
                                currentLabel="Currently enrolled"
                                onChange={(patch) => updateItem("education", edu.id, patch)}
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <Label>GPA (Optional)</Label>
                                    <Input value={edu.gpa} onChange={(e) => updateItem("education", edu.id, { gpa: e.target.value })} placeholder="3.8 / 4.0" />
                                </div>
                                <div>
                                    <Label>Minor (Optional)</Label>
                                    <Input value={edu.minor} onChange={(e) => updateItem("education", edu.id, { minor: e.target.value })} placeholder="Statistics" />
                                </div>
                            </div>
                            <div>
                                <Label>Honors / Coursework (Optional)</Label>
                                <Textarea value={edu.details} onChange={(e) => updateItem("education", edu.id, { details: e.target.value })} placeholder="Dean's List. Coursework: Distributed Systems, Machine Learning..." rows={2} />
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
                            isSelected={skill.isSelected}
                            onToggle={(checked) => updateItem("skills", skill.id, { isSelected: checked })}
                            onRemove={() => removeItem("skills", skill.id, deleteSkill)}
                            toggleHint="Toggle visibility for this skill category"
                        >
                            <div>
                                <Label>Category Name</Label>
                                <Input value={skill.category} onChange={(e) => updateItem("skills", skill.id, { category: e.target.value })} placeholder="Languages" />
                            </div>
                            <div>
                                <Label>Skills (Comma Separated)</Label>
                                <Input value={skill.items} onChange={(e) => updateItem("skills", skill.id, { items: e.target.value })} placeholder="Python, Java, TypeScript, Go, SQL" />
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
                            isSelected={project.isSelected}
                            onToggle={(checked) => updateItem("projects", project.id, { isSelected: checked })}
                            onRemove={() => removeItem("projects", project.id, deleteProject)}
                            toggleHint="Toggle visibility for this project"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <Label>Title</Label>
                                    <Input value={project.title} onChange={(e) => updateItem("projects", project.id, { title: e.target.value })} placeholder="Support Ticket Classifier" />
                                </div>
                                <div>
                                    <Label>Link (Optional)</Label>
                                    <Input value={project.link} onChange={(e) => updateItem("projects", project.id, { link: e.target.value })} placeholder="github.com/you/project" />
                                </div>
                            </div>
                            <div>
                                <Label>Tech Stack</Label>
                                <Input value={project.stack} onChange={(e) => updateItem("projects", project.id, { stack: e.target.value })} placeholder="PyTorch, FastAPI, Docker, AWS Lambda" />
                            </div>
                            <DateRangeFields
                                startDate={project.startDate}
                                endDate={project.endDate}
                                currentLabel="Ongoing"
                                onChange={(patch) => updateItem("projects", project.id, patch)}
                            />
                            <div>
                                <Label>Highlights (one per line)</Label>
                                <Textarea value={project.description} onChange={(e) => updateItem("projects", project.id, { description: e.target.value })} placeholder="What you built, with a number. Impact or scale." rows={4} />
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
                            isSelected={cert.isSelected}
                            onToggle={(checked) => updateItem("certifications", cert.id, { isSelected: checked })}
                            onRemove={() => removeItem("certifications", cert.id, deleteCertification)}
                            toggleHint="Toggle visibility for this certification"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-2">
                                    <Label>Name</Label>
                                    <Input value={cert.name} onChange={(e) => updateItem("certifications", cert.id, { name: e.target.value })} placeholder="AWS Certified Cloud Practitioner" />
                                </div>
                                <div>
                                    <Label>Year</Label>
                                    <Input value={cert.year} onChange={(e) => updateItem("certifications", cert.id, { year: e.target.value })} placeholder="2025" />
                                </div>
                                <div className="md:col-span-3">
                                    <Label>Issuer (Optional)</Label>
                                    <Input value={cert.issuer} onChange={(e) => updateItem("certifications", cert.id, { issuer: e.target.value })} placeholder="Amazon Web Services" />
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
