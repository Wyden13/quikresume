"use client";

import React, { useEffect, useState } from 'react';
import { ResumeData, WorkExperience, Education, SkillCategory } from "@/types/schema";
import { getUserProfile } from "@/app/actions/user-actions";
import { getSkills } from "@/app/actions/skill-actions";
import { saveResumeData } from "@/app/actions/resume-actions";

// --- LOCAL UI COMPONENTS (Styled with Tailwind) ---
const Label = ({ children, htmlFor, className = "" }: { children: React.ReactNode; htmlFor?: string; className?: string }) => (
    <label htmlFor={htmlFor} className={`block text-sm font-black text-black/40 mb-1.5 uppercase tracking-widest ${className}`}>
        {children}
    </label>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
        {...props}
        className={`w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-black outline-none transition-all font-medium ${props.className || ""}`}
    />
);

const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea
        {...props}
        className={`w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-black outline-none transition-all font-medium resize-none ${props.className || ""}`}
    />
);

const Button = ({ children, onClick, variant = "default", size = "md", className = "", disabled = false, loading = false }: { children: React.ReactNode; onClick?: () => void; variant?: "default" | "ghost" | "primary"; size?: "sm" | "md" | "lg"; className?: string; disabled?: boolean; loading?: boolean }) => {
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
        <button onClick={onClick} disabled={disabled || loading} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
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

interface ResumeFormProps {
    resumeData: ResumeData;
    onChange: (data: ResumeData) => void;
}

export function ResumeForm({ resumeData, onChange }: ResumeFormProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    // PREFILL PERSONAL INFO FROM MASTER LIBRARY ON INITIAL LOAD
    useEffect(() => {
        const prefillFromDB = async () => {
            if (isLoaded) return;

            const profile = await getUserProfile();
            // We only fetch skills here as others are synced via DashboardClient props now
            const sks = await getSkills();

            const fullName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : "";
            
            // Only update personal info if it's currently empty to avoid overwriting edits
            const shouldUpdateProfile = !resumeData.personalInfo.fullName;

            onChange({
                ...resumeData,
                personalInfo: shouldUpdateProfile ? {
                    fullName: String(fullName || resumeData.personalInfo.fullName || ""),
                    email: String(profile?.professionalEmail || profile?.email || resumeData.personalInfo.email || ""),
                    phone: String(profile?.phoneNumber || resumeData.personalInfo.phone || ""),
                    location: String(profile?.location || resumeData.personalInfo.location || ""),
                    summary: String(profile?.bio || profile?.overview || resumeData.personalInfo.summary || ""),
                } : resumeData.personalInfo,
                skills: sks.map(s => ({
                    id: s.id,
                    category: s.category,
                    items: s.items,
                    isSelected: s.isSelected,
                }))
            });
            setIsLoaded(true);
        };
        prefillFromDB();
    }, [isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleUpdateLibrary = async () => {
        setIsSaving(true);
        try {
            const result = await saveResumeData(resumeData);
            if (result.success) {
                alert("Master library synchronized successfully!");
            }
        } catch (error: unknown) {
            console.error("Failed to save:", error);
            alert(`Failed to update library: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setIsSaving(false);
        }
    };

    const updatePersonalInfo = (field: string, value: string) => {
        onChange({
            ...resumeData,
            personalInfo: { ...resumeData.personalInfo, [field]: value },
        });
    };

    const addWorkExperience = () => {
        onChange({
            ...resumeData,
            workExperience: [
                ...resumeData.workExperience,
                { id: Date.now().toString(), title: "", company: "", startDate: "", endDate: "", description: "", isSelected: true },
            ],
        });
    };

    const updateWorkExperience = (id: string, field: keyof WorkExperience, value: string | boolean) => {
        onChange({
            ...resumeData,
            workExperience: resumeData.workExperience.map((exp) =>
                exp.id === id ? { ...exp, [field]: value } : exp
            ),
        });
    };

    const removeWorkExperience = (id: string) => {
        onChange({
            ...resumeData,
            workExperience: resumeData.workExperience.filter((exp) => exp.id !== id),
        });
    };

    const addEducation = () => {
        onChange({
            ...resumeData,
            education: [
                ...resumeData.education,
                { id: Date.now().toString(), degree: "", institution: "", year: "", details: "", isSelected: true },
            ],
        });
    };

    const updateEducation = (id: string, field: keyof Education, value: string | boolean) => {
        onChange({
            ...resumeData,
            education: resumeData.education.map((edu) =>
                edu.id === id ? { ...edu, [field]: value } : edu
            ),
        });
    };

    const removeEducation = (id: string) => {
        onChange({
            ...resumeData,
            education: resumeData.education.filter((edu) => edu.id !== id),
        });
    };

    const addSkillCategory = () => {
        onChange({
            ...resumeData,
            skills: [
                ...resumeData.skills,
                { id: Date.now().toString(), category: "", items: "", isSelected: true },
            ],
        });
    };

    const updateSkillCategory = (id: string, field: keyof SkillCategory, value: string | boolean) => {
        onChange({
            ...resumeData,
            skills: resumeData.skills.map((skill) =>
                skill.id === id ? { ...skill, [field]: value } : skill
            ),
        });
    };

    const removeSkillCategory = (id: string) => {
        onChange({
            ...resumeData,
            skills: resumeData.skills.filter((skill) => skill.id !== id),
        });
    };

    return (
        <div className="h-full overflow-y-auto p-8 space-y-12 bg-white">
            {/* TOP ACTIONS BAR */}
            <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md flex justify-between items-center pb-8 border-b border-black/5 -mt-8 pt-8">
                <div>
                    <h2 className="text-2xl font-black tracking-tight uppercase">Master Editor</h2>
                    <p className="text-black/40 text-xs font-black uppercase tracking-widest mt-0.5">Sync changes to your library</p>
                </div>
                <Button 
                    onClick={handleUpdateLibrary} 
                    variant="primary" 
                    loading={isSaving}
                    className="shadow-xl shadow-black/20"
                >
                    <Save className="w-4 h-4 mr-2" />
                    Update Library
                </Button>
            </div>

            {/* Personal Information */}
            <section className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                        <span className="text-white text-[10px] font-black tracking-tighter">01</span>
                    </div>
                    <h2 className="text-xl font-black tracking-tight uppercase">Personal Information</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="col-span-full">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input
                            id="fullName"
                            value={resumeData.personalInfo.fullName}
                            onChange={(e) => updatePersonalInfo("fullName", e.target.value)}
                            placeholder="John Doe"
                        />
                    </div>
                    <div>
                        <Label htmlFor="email">Professional Email</Label>
                        <Input
                            id="email"
                            type="email"
                            value={resumeData.personalInfo.email}
                            onChange={(e) => updatePersonalInfo("email", e.target.value)}
                            placeholder="john@example.com"
                        />
                    </div>
                    <div>
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                            id="phone"
                            value={resumeData.personalInfo.phone}
                            onChange={(e) => updatePersonalInfo("phone", e.target.value)}
                            placeholder="(123) 456-7890"
                        />
                    </div>
                    <div className="col-span-full">
                        <Label htmlFor="location">Location</Label>
                        <Input
                            id="location"
                            value={resumeData.personalInfo.location}
                            onChange={(e) => updatePersonalInfo("location", e.target.value)}
                            placeholder="San Francisco, CA"
                        />
                    </div>
                    <div className="col-span-full">
                        <Label htmlFor="summary">Professional Overview</Label>
                        <Textarea
                            id="summary"
                            value={resumeData.personalInfo.summary}
                            onChange={(e) => updatePersonalInfo("summary", e.target.value)}
                            placeholder="Brief overview of your professional background and goals..."
                            rows={5}
                        />
                    </div>
                </div>
            </section>

            {/* Work Experience */}
            <section className="space-y-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                            <span className="text-white text-[10px] font-black tracking-tighter">02</span>
                        </div>
                        <h2 className="text-xl font-black tracking-tight uppercase">Work Experience</h2>
                    </div>
                    <Button onClick={addWorkExperience} size="sm" variant="default">
                        <Plus className="size-3 mr-2" />
                        Add New
                    </Button>
                </div>
                <div className="space-y-6">
                    {resumeData.workExperience.map((exp) => (
                        <div key={exp.id} className="p-8 border-2 border-black/5 bg-gray-50/30 rounded-[2rem] space-y-6 relative group transition-all hover:bg-white hover:border-black/10 hover:shadow-2xl hover:shadow-black/5">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeWorkExperience(exp.id)}
                                className="absolute top-4 right-4 text-black/10 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 className="size-4" />
                            </Button>
                            <div className="space-y-6">
                                <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-black/5">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black uppercase tracking-tight">Include on Resume</span>
                                        <span className="text-[10px] text-black/40 font-bold uppercase tracking-widest">Toggle visibility for this role</span>
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        checked={exp.isSelected}
                                        onChange={(e) => updateWorkExperience(exp.id, "isSelected", e.target.checked)}
                                        className="w-6 h-6 accent-black cursor-pointer"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <Label>Position</Label>
                                        <Input
                                            value={exp.title}
                                            onChange={(e) => updateWorkExperience(exp.id, "title", e.target.value)}
                                            placeholder="Senior Software Engineer"
                                        />
                                    </div>
                                    <div>
                                        <Label>Company</Label>
                                        <Input
                                            value={exp.company}
                                            onChange={(e) => updateWorkExperience(exp.id, "company", e.target.value)}
                                            placeholder="Tech Corp"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <Label>Start Date</Label>
                                        <Input
                                            value={exp.startDate}
                                            onChange={(e) => updateWorkExperience(exp.id, "startDate", e.target.value)}
                                            placeholder="YYYY-MM-DD"
                                            type="date"
                                        />
                                    </div>
                                    <div>
                                        <Label>End Date</Label>
                                        <Input
                                            value={exp.endDate}
                                            onChange={(e) => updateWorkExperience(exp.id, "endDate", e.target.value)}
                                            placeholder="YYYY-MM-DD or 'Present'"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label>Responsibilities (Bulleted List)</Label>
                                    <Textarea
                                        value={exp.description}
                                        onChange={(e) => updateWorkExperience(exp.id, "description", e.target.value)}
                                        placeholder="Enter your key achievements, one per line..."
                                        rows={4}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Education */}
            <section className="space-y-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                            <span className="text-white text-[10px] font-black tracking-tighter">03</span>
                        </div>
                        <h2 className="text-xl font-black tracking-tight uppercase">Academic History</h2>
                    </div>
                    <Button onClick={addEducation} size="sm" variant="default">
                        <Plus className="size-3 mr-2" />
                        Add New
                    </Button>
                </div>
                <div className="space-y-6">
                    {resumeData.education.map((edu) => (
                        <div key={edu.id} className="p-8 border-2 border-black/5 bg-gray-50/30 rounded-[2rem] space-y-6 relative group transition-all hover:bg-white hover:border-black/10 hover:shadow-2xl hover:shadow-black/5">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeEducation(edu.id)}
                                className="absolute top-4 right-4 text-black/10 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 className="size-4" />
                            </Button>
                            <div className="space-y-6">
                                <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-black/5">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black uppercase tracking-tight">Include on Resume</span>
                                        <span className="text-[10px] text-black/40 font-bold uppercase tracking-widest">Toggle visibility for this education</span>
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        checked={edu.isSelected}
                                        onChange={(e) => updateEducation(edu.id, "isSelected", e.target.checked)}
                                        className="w-6 h-6 accent-black cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <Label>Degree / Program</Label>
                                    <Input
                                        value={edu.degree}
                                        onChange={(e) => updateEducation(edu.id, "degree", e.target.value)}
                                        placeholder="Bachelor of Science in Computer Science"
                                    />
                                </div>
                                <div>
                                    <Label>Institution</Label>
                                    <Input
                                        value={edu.institution}
                                        onChange={(e) => updateEducation(edu.id, "institution", e.target.value)}
                                        placeholder="University of California"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <Label>Period (e.g., 2016 - 2020)</Label>
                                        <Input
                                            value={edu.year}
                                            onChange={(e) => updateEducation(edu.id, "year", e.target.value)}
                                            placeholder="2016 - 2020"
                                        />
                                    </div>
                                    <div>
                                        <Label>GPA / Honors (Optional)</Label>
                                        <Input
                                            value={edu.details}
                                            onChange={(e) => updateEducation(edu.id, "details", e.target.value)}
                                            placeholder="GPA: 3.8, Magna Cum Laude"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Skills */}
            <section className="space-y-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                            <span className="text-white text-[10px] font-black tracking-tighter">04</span>
                        </div>
                        <h2 className="text-xl font-black tracking-tight uppercase">Skill Categories</h2>
                    </div>
                    <Button onClick={addSkillCategory} size="sm" variant="default">
                        <Plus className="size-3 mr-2" />
                        Add Category
                    </Button>
                </div>
                <div className="space-y-6">
                    {resumeData.skills.map((skill) => (
                        <div key={skill.id} className="p-8 border-2 border-black/5 bg-gray-50/30 rounded-[2rem] space-y-6 relative group transition-all hover:bg-white hover:border-black/10 hover:shadow-2xl hover:shadow-black/5">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeSkillCategory(skill.id)}
                                className="absolute top-4 right-4 text-black/10 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 className="size-4" />
                            </Button>
                            <div className="space-y-6">
                                <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-black/5">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black uppercase tracking-tight">Include on Resume</span>
                                        <span className="text-[10px] text-black/40 font-bold uppercase tracking-widest">Toggle visibility for this skill category</span>
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        checked={skill.isSelected}
                                        onChange={(e) => updateSkillCategory(skill.id, "isSelected", e.target.checked)}
                                        className="w-6 h-6 accent-black cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <Label>Category Name</Label>
                                    <Input
                                        value={skill.category}
                                        onChange={(e) => updateSkillCategory(skill.id, "category", e.target.value)}
                                        placeholder="Programming Languages"
                                    />
                                </div>
                                <div>
                                    <Label>Skills (Comma Separated)</Label>
                                    <Input
                                        value={skill.items}
                                        onChange={(e) => updateSkillCategory(skill.id, "items", e.target.value)}
                                        placeholder="JavaScript, Python, Java, C++"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
