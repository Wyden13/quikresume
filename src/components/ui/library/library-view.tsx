"use client";

import React from "react";
import type { ResumeListKey } from "@/types/schema";
import type {
    AwardItem, CertificationItem, EducationItem, ExperienceItem, LanguageItem, ProjectItem, PublicationItem,
    SkillCategoryItem, VolunteeringItem,
} from "@/types/db";
import { deleteExperience, updateExperience } from "@/app/actions/experience-actions";
import { deleteEducation, updateEducation } from "@/app/actions/education-actions";
import { deleteSkill, updateSkill } from "@/app/actions/skill-actions";
import { deleteProject, updateProject } from "@/app/actions/project-actions";
import { deleteCertification, updateCertification } from "@/app/actions/certification-actions";
import { deleteAward, updateAward } from "@/app/actions/award-actions";
import { deleteVolunteering, updateVolunteering } from "@/app/actions/volunteering-actions";
import { deletePublication, updatePublication } from "@/app/actions/publication-actions";
import { deleteLanguage, updateLanguage } from "@/app/actions/language-actions";
import { formatDateRange, formatMonthYear, PRESENT } from "@/lib/dates";
import { SECTION_LABEL } from "@/lib/sections";
import type { SectionTab } from "@/components/ui/section-tabs";
import { LibrarySection } from "./library-section";
import { Bullets, Detail, LibraryRow } from "./library-row";
import { EmptyState } from "@/components/ui/primitives/empty-state";
import { Button } from "@/components/ui/primitives/button";
import {
    Award, BadgeCheck, BookOpen, Briefcase, FolderGit2, GraduationCap, HeartHandshake, Languages, Library, Wrench,
    type LucideIcon,
} from "@/components/ui/primitives/icons";

export const SECTION_ICON: Record<ResumeListKey, LucideIcon> = {
    workExperience: Briefcase,
    education: GraduationCap,
    projects: FolderGit2,
    skills: Wrench,
    volunteering: HeartHandshake,
    publications: BookOpen,
    awards: Award,
    certifications: BadgeCheck,
    languages: Languages,
};

/** Display order of the library sections (most résumé-defining first). */
export const LIBRARY_ORDER: ResumeListKey[] = [
    "workExperience", "education", "projects", "skills", "volunteering", "publications", "awards", "certifications", "languages",
];

export interface LibraryLists {
    experiences: ExperienceItem[];
    educations: EducationItem[];
    skills: SkillCategoryItem[];
    projects: ProjectItem[];
    certifications: CertificationItem[];
    awards: AwardItem[];
    volunteering: VolunteeringItem[];
    publications: PublicationItem[];
    languages: LanguageItem[];
}

export function libraryCounts(lists: LibraryLists): Record<ResumeListKey, number> {
    return {
        workExperience: lists.experiences.length,
        education: lists.educations.length,
        projects: lists.projects.length,
        skills: lists.skills.length,
        volunteering: lists.volunteering.length,
        publications: lists.publications.length,
        awards: lists.awards.length,
        certifications: lists.certifications.length,
        languages: lists.languages.length,
    };
}

interface LibraryViewProps extends LibraryLists {
    tab: SectionTab;
    variantUsage: Record<string, string[]>;
    onImport: () => void;
    onEdit: () => void;
}

export function LibraryView({ tab, variantUsage, onImport, onEdit, ...lists }: LibraryViewProps) {
    const counts = libraryCounts(lists);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    if (total === 0) {
        return (
            <EmptyState
                icon={Library}
                title="Your library is empty"
                body="Import an existing résumé to fill it in seconds, or add items by hand in the editor."
                actions={
                    <>
                        <Button variant="primary" onClick={onImport}>Import résumé</Button>
                        <Button onClick={onEdit}>Open editor</Button>
                    </>
                }
            />
        );
    }

    const show = (key: ResumeListKey) => (tab === "all" || tab === key) && counts[key] > 0;
    const range = (start: string | null, end: string | null | undefined, isActive: boolean) => formatDateRange(start, isActive ? PRESENT : end);

    return (
        <div className="space-y-8">
            {show("workExperience") && (
                <LibrarySection icon={SECTION_ICON.workExperience} title={SECTION_LABEL.workExperience} ids={lists.experiences.map(x => x.id)}>
                    {lists.experiences.map(x => (
                        <LibraryRow key={x.id} id={x.id} title={x.position} subtitle={x.company} meta={range(x.startDate, x.endDate, x.isActive)}
                            isSelected={x.isSelected} active={{ isActive: x.isActive, type: "experience" }} tags={x.tags} usedBy={variantUsage[x.id]}
                            onUpdate={updateExperience} onDelete={deleteExperience}>
                            <Bullets items={x.description} />
                        </LibraryRow>
                    ))}
                </LibrarySection>
            )}
            {show("education") && (
                <LibrarySection icon={SECTION_ICON.education} title={SECTION_LABEL.education} ids={lists.educations.map(x => x.id)}>
                    {lists.educations.map(x => (
                        <LibraryRow key={x.id} id={x.id} title={x.programName} subtitle={x.schoolName} meta={range(x.startDate, x.endDate, x.isActive)}
                            isSelected={x.isSelected} active={{ isActive: x.isActive, type: "education" }} tags={x.tags} usedBy={variantUsage[x.id]}
                            onUpdate={updateEducation} onDelete={deleteEducation}>
                            <div className="flex flex-wrap gap-1.5">
                                <Detail label="GPA" value={x.gpa} />
                                <Detail label="Minor" value={x.minorName} />
                                <Detail label="Location" value={[x.locationCity, x.locationProvince].filter(Boolean).join(", ")} />
                            </div>
                            {x.details && <p className="text-fg-muted leading-relaxed">{x.details}</p>}
                        </LibraryRow>
                    ))}
                </LibrarySection>
            )}
            {show("projects") && (
                <LibrarySection icon={SECTION_ICON.projects} title={SECTION_LABEL.projects} ids={lists.projects.map(x => x.id)}>
                    {lists.projects.map(x => (
                        <LibraryRow key={x.id} id={x.id} title={x.title} subtitle={x.stack ?? ""} meta={range(x.startDate, x.endDate, x.isActive)}
                            isSelected={x.isSelected} active={{ isActive: x.isActive, type: "project" }} tags={x.tags} usedBy={variantUsage[x.id]}
                            onUpdate={updateProject} onDelete={deleteProject}>
                            {x.link && <p className="break-all text-fg-muted">{x.link}</p>}
                            <Bullets items={x.description} />
                        </LibraryRow>
                    ))}
                </LibrarySection>
            )}
            {show("skills") && (
                <LibrarySection icon={SECTION_ICON.skills} title={SECTION_LABEL.skills} ids={lists.skills.map(x => x.id)}>
                    {lists.skills.map(x => (
                        <LibraryRow key={x.id} id={x.id} title={x.category} subtitle={x.items} isSelected={x.isSelected} tags={x.tags} usedBy={variantUsage[x.id]}
                            onUpdate={updateSkill} onDelete={deleteSkill}>
                            <p className="text-fg-muted leading-relaxed">{x.items}</p>
                        </LibraryRow>
                    ))}
                </LibrarySection>
            )}
            {show("volunteering") && (
                <LibrarySection icon={SECTION_ICON.volunteering} title={SECTION_LABEL.volunteering} ids={lists.volunteering.map(x => x.id)}>
                    {lists.volunteering.map(x => (
                        <LibraryRow key={x.id} id={x.id} title={x.role} subtitle={x.organization} meta={range(x.startDate, x.endDate, x.isActive)}
                            isSelected={x.isSelected} active={{ isActive: x.isActive, type: "volunteering" }} tags={x.tags} usedBy={variantUsage[x.id]}
                            onUpdate={updateVolunteering} onDelete={deleteVolunteering}>
                            <Bullets items={x.description} />
                        </LibraryRow>
                    ))}
                </LibrarySection>
            )}
            {show("publications") && (
                <LibrarySection icon={SECTION_ICON.publications} title={SECTION_LABEL.publications} ids={lists.publications.map(x => x.id)}>
                    {lists.publications.map(x => (
                        <LibraryRow key={x.id} id={x.id} title={x.title} subtitle={[x.authors, x.venue].filter(Boolean).join(" · ")} meta={formatMonthYear(x.date)}
                            isSelected={x.isSelected} tags={x.tags} usedBy={variantUsage[x.id]} onUpdate={updatePublication} onDelete={deletePublication}>
                            {x.authors && <p className="text-fg-muted">{x.authors}</p>}
                            {x.venue && <p className="text-fg-muted">{x.venue}</p>}
                            {x.link && <p className="break-all text-fg-muted">{x.link}</p>}
                        </LibraryRow>
                    ))}
                </LibrarySection>
            )}
            {show("awards") && (
                <LibrarySection icon={SECTION_ICON.awards} title={SECTION_LABEL.awards} ids={lists.awards.map(x => x.id)}>
                    {lists.awards.map(x => (
                        <LibraryRow key={x.id} id={x.id} title={x.title} subtitle={x.issuer ?? ""} meta={formatMonthYear(x.date)}
                            isSelected={x.isSelected} tags={x.tags} usedBy={variantUsage[x.id]} onUpdate={updateAward} onDelete={deleteAward}>
                            {x.description && <p className="text-fg-muted leading-relaxed">{x.description}</p>}
                        </LibraryRow>
                    ))}
                </LibrarySection>
            )}
            {show("certifications") && (
                <LibrarySection icon={SECTION_ICON.certifications} title={SECTION_LABEL.certifications} ids={lists.certifications.map(x => x.id)}>
                    {lists.certifications.map(x => (
                        <LibraryRow key={x.id} id={x.id} title={x.name} subtitle={x.issuer ?? ""} meta={x.year}
                            isSelected={x.isSelected} tags={x.tags} usedBy={variantUsage[x.id]} onUpdate={updateCertification} onDelete={deleteCertification} />
                    ))}
                </LibrarySection>
            )}
            {show("languages") && (
                <LibrarySection icon={SECTION_ICON.languages} title={SECTION_LABEL.languages} ids={lists.languages.map(x => x.id)}>
                    {lists.languages.map(x => (
                        <LibraryRow key={x.id} id={x.id} title={x.language} subtitle={x.proficiency ?? ""}
                            isSelected={x.isSelected} tags={x.tags} usedBy={variantUsage[x.id]} onUpdate={updateLanguage} onDelete={deleteLanguage} />
                    ))}
                </LibrarySection>
            )}
        </div>
    );
}
