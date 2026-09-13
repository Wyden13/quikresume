// src/types/db.ts
// Serialized Firestore rows as returned by the get* server actions
// (Timestamps already converted to ISO strings). Kept out of the "use server"
// modules so client code and pure mappers can import the types freely.

export interface UserProfile {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    headline?: string | null;
    /** Set by the NextAuth adapter from the Google account. */
    email?: string | null;
    professionalEmail?: string | null;
    phoneNumber?: string | null;
    location?: string | null;
    github?: string | null;
    linkedIn?: string | null;
    website?: string | null;
    bio?: string | null;
}

export interface ExperienceItem {
    id: string;
    position: string;
    company: string;
    isActive: boolean;
    isSelected: boolean;
    startDate: string | null;
    endDate: string | null;
    description: string[];
    createdAt: string | null;
    updatedAt?: string | null;
}

export interface EducationItem {
    id: string;
    schoolName: string;
    locationCity?: string | null;
    locationProvince?: string | null;
    locationCountry?: string | null;
    programName: string;
    minorName?: string | null;
    doubleMajor?: string | null;
    gpa?: string | null;
    details?: string | null;
    startDate: string | null;
    endDate: string | null;
    isActive: boolean;
    isSelected: boolean;
    createdAt: string | null;
    updatedAt?: string | null;
}

export interface SkillCategoryItem {
    id: string;
    category: string;
    items: string;
    isSelected: boolean;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface ProjectItem {
    id: string;
    title: string;
    stack: string | null;
    link: string | null;
    startDate: string | null;
    endDate: string | null;
    isActive: boolean;
    description: string[];
    isSelected: boolean;
    createdAt: string | null;
    updatedAt?: string | null;
}

export interface CertificationItem {
    id: string;
    name: string;
    issuer: string | null;
    year: string;
    isSelected: boolean;
    createdAt: string | null;
    updatedAt?: string | null;
}
