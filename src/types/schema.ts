// src/types/schema.ts
// The editor / preview model. This is what ResumeForm edits, what
// saveResumeData receives, and what toTypstDoc turns into a Typst document.
//
// Date conventions:
//   startDate: "YYYY-MM-DD" | ""
//   endDate:   "YYYY-MM-DD" | "Present" | ""
//   description: newline-separated bullet points

export interface PersonalInfo {
    firstName: string;
    lastName: string;
    /** One-line tagline under the name, e.g. "B.S. Computer Science, Class of 2026". */
    headline: string;
    email: string;
    phone: string;
    location: string;
    github: string;
    linkedin: string;
    website: string;
    summary: string;
}

export interface WorkExperience {
    id: string;
    title: string;
    company: string;
    startDate: string;
    endDate: string;
    description: string;
    isSelected: boolean;
}

export interface Education {
    id: string;
    degree: string;
    institution: string;
    startDate: string;
    endDate: string;
    gpa: string;
    minor: string;
    /** Coursework, honors, dean's list, etc. */
    details: string;
    isSelected: boolean;
}

export interface SkillCategory {
    id: string;
    category: string;
    items: string;
    isSelected: boolean;
}

export interface Project {
    id: string;
    title: string;
    /** Tech stack / meta line, e.g. "PyTorch, FastAPI, Docker". */
    stack: string;
    link: string;
    startDate: string;
    endDate: string;
    description: string;
    isSelected: boolean;
}

export interface Certification {
    id: string;
    name: string;
    issuer: string;
    year: string;
    isSelected: boolean;
}

export interface ResumeData {
    personalInfo: PersonalInfo;
    workExperience: WorkExperience[];
    education: Education[];
    skills: SkillCategory[];
    projects: Project[];
    certifications: Certification[];
}

export function emptyPersonalInfo(): PersonalInfo {
    return {
        firstName: "",
        lastName: "",
        headline: "",
        email: "",
        phone: "",
        location: "",
        github: "",
        linkedin: "",
        website: "",
        summary: "",
    };
}

export function emptyResumeData(): ResumeData {
    return {
        personalInfo: emptyPersonalInfo(),
        workExperience: [],
        education: [],
        skills: [],
        projects: [],
        certifications: [],
    };
}
