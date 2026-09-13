// src/types/db.ts
// Serialized Firestore rows as returned by the get* server actions
// (Timestamps already converted to ISO strings). Kept out of the "use server"
// modules so client code and pure mappers can import the types freely.

import type { Tag } from "@/lib/tags/types";
import type { VariantItems } from "@/lib/variants";

/** Smart-tag fields present on every library item row. */
export interface TagFields {
    tags: Tag[];
    /** Hash of the content fields at the last write (null for rows written before tags existed). */
    contentHash: string | null;
    /** Hash the tags were extracted from; differs from the content hash when the item is stale. */
    tagsHash: string | null;
}

export interface UserProfile {
    id: string;
    profileTags?: Tag[];
    profileTagsHash?: string | null;
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

export interface ExperienceItem extends TagFields {
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

export interface EducationItem extends TagFields {
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

export interface SkillCategoryItem extends TagFields {
    id: string;
    category: string;
    items: string;
    isSelected: boolean;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface ProjectItem extends TagFields {
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

export interface CertificationItem extends TagFields {
    id: string;
    name: string;
    issuer: string | null;
    year: string;
    isSelected: boolean;
    createdAt: string | null;
    updatedAt?: string | null;
}

export interface AwardItem extends TagFields {
    id: string;
    title: string;
    issuer: string | null;
    date: string | null;
    description: string | null;
    isSelected: boolean;
    createdAt: string | null;
    updatedAt?: string | null;
}

export interface VolunteeringItem extends TagFields {
    id: string;
    role: string;
    organization: string;
    startDate: string | null;
    endDate: string | null;
    isActive: boolean;
    description: string[];
    isSelected: boolean;
    createdAt: string | null;
    updatedAt?: string | null;
}

export interface PublicationItem extends TagFields {
    id: string;
    title: string;
    venue: string | null;
    date: string | null;
    link: string | null;
    authors: string | null;
    isSelected: boolean;
    createdAt: string | null;
    updatedAt?: string | null;
}

export interface LanguageItem extends TagFields {
    id: string;
    language: string;
    proficiency: string | null;
    isSelected: boolean;
    createdAt: string | null;
    updatedAt?: string | null;
}

/** A saved resume variant: soft pointers to library items (nothing rendered is stored). */
export interface ResumeVariant {
    id: string;
    name: string;
    /** Free-text labels such as the company it was sent to. */
    labels: string[];
    /** Firestore collection name -> item ids included in this variant. */
    items: VariantItems;
    templateId: string;
    createdAt: string | null;
    updatedAt: string | null;
}
