// src/types/schema.ts

export interface PersonalInfo {
    firstName: string;
    middleName?: string;
    lastName: string;
    linkedIn?: string;
    email: string;
    phoneNumber: string;
    location?: string;
    bio?: string;
    overview?: string;
    availability?: string;
}

export interface WorkExperience {
    id: string;
    title: string;
    company: string;
    startDate: string;
    endDate: string;
    description: string;
}

export interface Education {
    id: string;
    degree: string;
    institution: string;
    year: string;
    details: string;
}

export interface SkillCategory {
    id: string;
    category: string;
    items: string;
}

export interface ResumeData {
    personalInfo: {
        fullName: string;
        email: string;
        phone: string;
        location: string;
        summary: string;
    };
    workExperience: WorkExperience[];
    education: Education[];
    skills: SkillCategory[];
}
