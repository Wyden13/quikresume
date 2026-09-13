"use client";

// Per-section editor configuration: how to create a blank item and which
// fields to render for it. The container (resume-form.tsx) stays generic.

import React from "react";
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
import { newTempId } from "@/lib/ids";
import { Field, Input, Textarea } from "@/components/ui/primitives/field";
import { DateRangeFields } from "./date-range-fields";

type ItemOf<K extends ResumeListKey> = ResumeData[K][number];
type Patch<K extends ResumeListKey> = (patch: Partial<ItemOf<K>>) => void;

export interface SectionConfig<K extends ResumeListKey> {
    addLabel: string;
    create: () => ItemOf<K>;
    remove: (id: string) => Promise<void>;
    fields: (item: ItemOf<K>, set: Patch<K>) => React.ReactNode;
}

const base = () => ({ id: newTempId(), isSelected: true, tags: [], tagsHash: null });
const fid = (itemId: string, field: string) => `${itemId}-${field}`;

function Text<K extends ResumeListKey>({ item, set, field, label, placeholder, type, className }: { item: ItemOf<K>; set: Patch<K>; field: keyof ItemOf<K> & string; label: string; placeholder?: string; type?: string; className?: string }) {
    return (
        <Field label={label} htmlFor={fid(item.id, field)} className={className}>
            <Input id={fid(item.id, field)} type={type} value={item[field] as string} onChange={e => set({ [field]: e.target.value } as Partial<ItemOf<K>>)} placeholder={placeholder} />
        </Field>
    );
}

function Lines<K extends ResumeListKey>({ item, set, field, label, placeholder, rows = 4 }: { item: ItemOf<K>; set: Patch<K>; field: keyof ItemOf<K> & string; label: string; placeholder?: string; rows?: number }) {
    return (
        <Field label={label} htmlFor={fid(item.id, field)}>
            <Textarea id={fid(item.id, field)} value={item[field] as string} onChange={e => set({ [field]: e.target.value } as Partial<ItemOf<K>>)} placeholder={placeholder} rows={rows} />
        </Field>
    );
}

const two = "grid gap-4 md:grid-cols-2";

export const SECTION_CONFIG: { [K in ResumeListKey]: SectionConfig<K> } = {
    workExperience: {
        addLabel: "Add role",
        create: (): WorkExperience => ({ ...base(), title: "", company: "", startDate: "", endDate: "", description: "" }),
        remove: deleteExperience,
        fields: (x, set) => (
            <>
                <div className={two}>
                    <Text item={x} set={set} field="title" label="Position" placeholder="Senior Software Engineer" />
                    <Text item={x} set={set} field="company" label="Company" placeholder="Tech Corp" />
                </div>
                <DateRangeFields idPrefix={x.id} startDate={x.startDate} endDate={x.endDate} currentLabel="I work here now" onChange={set} />
                <Lines item={x} set={set} field="description" label="Responsibilities (one per line)" placeholder="Key achievements, one per line…" />
            </>
        ),
    },
    education: {
        addLabel: "Add education",
        create: (): Education => ({ ...base(), degree: "", institution: "", startDate: "", endDate: "", gpa: "", minor: "", details: "" }),
        remove: deleteEducation,
        fields: (x, set) => (
            <>
                <div className={two}>
                    <Text item={x} set={set} field="degree" label="Degree / program" placeholder="B.S. in Computer Science" />
                    <Text item={x} set={set} field="institution" label="Institution" placeholder="State University" />
                </div>
                <DateRangeFields idPrefix={x.id} startDate={x.startDate} endDate={x.endDate} currentLabel="Currently enrolled" onChange={set} />
                <div className={two}>
                    <Text item={x} set={set} field="gpa" label="GPA (optional)" placeholder="3.8 / 4.0" />
                    <Text item={x} set={set} field="minor" label="Minor (optional)" placeholder="Statistics" />
                </div>
                <Lines item={x} set={set} field="details" label="Honors / coursework (optional)" placeholder="Dean's List. Coursework: Distributed Systems, Machine Learning…" rows={2} />
            </>
        ),
    },
    skills: {
        addLabel: "Add category",
        create: (): SkillCategory => ({ ...base(), category: "", items: "" }),
        remove: deleteSkill,
        fields: (x, set) => (
            <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
                <Text item={x} set={set} field="category" label="Category" placeholder="Languages" />
                <Text item={x} set={set} field="items" label="Skills (comma separated)" placeholder="Python, Java, TypeScript, Go, SQL" />
            </div>
        ),
    },
    projects: {
        addLabel: "Add project",
        create: (): Project => ({ ...base(), title: "", stack: "", link: "", startDate: "", endDate: "", description: "" }),
        remove: deleteProject,
        fields: (x, set) => (
            <>
                <div className={two}>
                    <Text item={x} set={set} field="title" label="Title" placeholder="Support Ticket Classifier" />
                    <Text item={x} set={set} field="link" label="Link (optional)" placeholder="github.com/you/project" />
                </div>
                <Text item={x} set={set} field="stack" label="Tech stack" placeholder="PyTorch, FastAPI, Docker, AWS Lambda" />
                <DateRangeFields idPrefix={x.id} startDate={x.startDate} endDate={x.endDate} currentLabel="Ongoing" onChange={set} />
                <Lines item={x} set={set} field="description" label="Highlights (one per line)" placeholder="What you built, with a number. Impact or scale." />
            </>
        ),
    },
    certifications: {
        addLabel: "Add certification",
        create: (): Certification => ({ ...base(), name: "", issuer: "", year: "" }),
        remove: deleteCertification,
        fields: (x, set) => (
            <div className="grid gap-4 md:grid-cols-3">
                <Text item={x} set={set} field="name" label="Name" placeholder="AWS Certified Cloud Practitioner" className="md:col-span-2" />
                <Text item={x} set={set} field="year" label="Year" placeholder="2025" />
                <Text item={x} set={set} field="issuer" label="Issuer (optional)" placeholder="Amazon Web Services" className="md:col-span-3" />
            </div>
        ),
    },
    volunteering: {
        addLabel: "Add activity",
        create: (): Volunteering => ({ ...base(), role: "", organization: "", startDate: "", endDate: "", description: "" }),
        remove: deleteVolunteering,
        fields: (x, set) => (
            <>
                <div className={two}>
                    <Text item={x} set={set} field="role" label="Role" placeholder="Coding Mentor" />
                    <Text item={x} set={set} field="organization" label="Organization" placeholder="Girls Who Code" />
                </div>
                <DateRangeFields idPrefix={x.id} startDate={x.startDate} endDate={x.endDate} currentLabel="Still involved" onChange={set} />
                <Lines item={x} set={set} field="description" label="Highlights (one per line)" placeholder="What you did and the impact, one per line…" rows={3} />
            </>
        ),
    },
    publications: {
        addLabel: "Add publication",
        create: (): Publication => ({ ...base(), title: "", venue: "", date: "", link: "", authors: "" }),
        remove: deletePublication,
        fields: (x, set) => (
            <>
                <Text item={x} set={set} field="title" label="Title" placeholder="Efficient Tracing at Scale" />
                <div className="grid gap-4 md:grid-cols-3">
                    <Text item={x} set={set} field="venue" label="Venue / publisher" placeholder="USENIX ATC" className="md:col-span-2" />
                    <Text item={x} set={set} field="date" label="Date" type="date" />
                </div>
                <div className={two}>
                    <Text item={x} set={set} field="authors" label="Authors (optional)" placeholder="A. Morgan, J. Doe" />
                    <Text item={x} set={set} field="link" label="Link (optional)" placeholder="doi.org/10.1000/xyz" />
                </div>
            </>
        ),
    },
    awards: {
        addLabel: "Add award",
        create: (): Award => ({ ...base(), title: "", issuer: "", date: "", description: "" }),
        remove: deleteAward,
        fields: (x, set) => (
            <>
                <div className="grid gap-4 md:grid-cols-3">
                    <Text item={x} set={set} field="title" label="Title" placeholder="Dean's List" className="md:col-span-2" />
                    <Text item={x} set={set} field="date" label="Date" type="date" />
                    <Text item={x} set={set} field="issuer" label="Issuer (optional)" placeholder="State University" className="md:col-span-3" />
                </div>
                <Lines item={x} set={set} field="description" label="Description (optional)" placeholder="Top 5% of the class, 3 semesters running." rows={2} />
            </>
        ),
    },
    languages: {
        addLabel: "Add language",
        create: (): Language => ({ ...base(), language: "", proficiency: "" }),
        remove: deleteLanguage,
        fields: (x, set) => (
            <div className={two}>
                <Text item={x} set={set} field="language" label="Language" placeholder="French" />
                <Text item={x} set={set} field="proficiency" label="Proficiency (optional)" placeholder="Native / Fluent / B2" />
            </div>
        ),
    },
};
