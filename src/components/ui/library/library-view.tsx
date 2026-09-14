"use client";

import React, { startTransition, useOptimistic, useState } from "react";
import type { ResumeData, ResumeListKey } from "@/types/schema";
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
import { Detail, LibraryRow, SubItemToggles } from "./library-row";
import { bulletEntries, bulletLines, hiddenCount, skillEntries, visible } from "@/lib/sub-items";
import { EmptyState } from "@/components/ui/primitives/empty-state";
import { SortableList, useSortableRow } from "@/components/ui/primitives/sortable";
import { updateLayout } from "@/app/actions/layout-actions";
import { hasManualOrder, isDatedSection, moveItem, moveSection, orderedItems, resetItemOrder } from "@/lib/layout/order";
import type { ResumeLayout, SectionId } from "@/lib/layout/types";
import { Button } from "@/components/ui/primitives/button";
import {
    ArrowDownWideNarrow, Award, BadgeCheck, BookOpen, Briefcase, FolderGit2, GraduationCap, HeartHandshake, Languages, Library, Wrench,
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
    /** Editor model of the same library: item dates for ordering, and the saved layout. */
    resumeData: ResumeData;
    onImport: () => void;
    onEdit: () => void;
}

export function LibraryView({ tab, variantUsage, resumeData, onImport, onEdit, ...lists }: LibraryViewProps) {
    const counts = libraryCounts(lists);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    // Dragging saves straight away; the optimistic layout shows the new order until revalidation lands.
    const [layout, setOptimisticLayout] = useOptimistic(resumeData.layout);
    const [draggingSection, setDraggingSection] = useState(false);

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

    const saveLayout = (next: ResumeLayout) => {
        startTransition(async () => {
            setOptimisticLayout(next);
            await updateLayout(next);
        });
    };

    const show = (key: ResumeListKey) => (tab === "all" || tab === key) && counts[key] > 0;
    const range = (start: string | null, end: string | null | undefined, isActive: boolean) => formatDateRange(start, isActive ? PRESENT : end);

    /** Rows in print order: the editor model decides the order, the Firestore rows render. */
    const ordered = <T extends { id: string }>(key: ResumeListKey, rows: T[]): T[] => {
        const byId = new Map(rows.map(r => [r.id, r]));
        return orderedItems(key, resumeData[key] as ResumeData[ResumeListKey][number][], layout)
            .map(it => byId.get(it.id))
            .filter((r): r is T => r !== undefined);
    };

    const renderRows: Record<ResumeListKey, () => { ids: string[]; labels: Record<string, string>; rows: React.ReactNode }> = {
        workExperience: () => {
            const xs = ordered("workExperience", lists.experiences);
            return {
                ids: xs.map(x => x.id), labels: Object.fromEntries(xs.map(x => [x.id, x.position])),
                rows: xs.map(x => (
                    <SortableLibraryRow key={x.id} id={x.id} title={x.position} subtitle={x.company} meta={range(x.startDate, x.endDate, x.isActive)} hiddenCount={hiddenCount(bulletEntries(bulletLines(x.description)), x.hidden)}
                        isSelected={x.isSelected} active={{ isActive: x.isActive, type: "experience" }} tags={x.tags} usedBy={variantUsage[x.id]}
                        onUpdate={updateExperience} onDelete={deleteExperience}>
                        <SubItemToggles id={x.id} entries={bulletEntries(bulletLines(x.description))} hidden={x.hidden} onUpdate={updateExperience} variant="bullets" />
                    </SortableLibraryRow>
                )),
            };
        },
        education: () => {
            const xs = ordered("education", lists.educations);
            return {
                ids: xs.map(x => x.id), labels: Object.fromEntries(xs.map(x => [x.id, x.programName])),
                rows: xs.map(x => (
                    <SortableLibraryRow key={x.id} id={x.id} title={x.programName} subtitle={x.schoolName} meta={range(x.startDate, x.endDate, x.isActive)}
                        isSelected={x.isSelected} active={{ isActive: x.isActive, type: "education" }} tags={x.tags} usedBy={variantUsage[x.id]}
                        onUpdate={updateEducation} onDelete={deleteEducation}>
                        <div className="flex flex-wrap gap-1.5">
                            <Detail label="GPA" value={x.gpa} />
                            <Detail label="Minor" value={x.minorName} />
                            <Detail label="Location" value={[x.locationCity, x.locationProvince].filter(Boolean).join(", ")} />
                        </div>
                        {x.details && <p className="text-fg-muted leading-relaxed">{x.details}</p>}
                    </SortableLibraryRow>
                )),
            };
        },
        projects: () => {
            const xs = ordered("projects", lists.projects);
            return {
                ids: xs.map(x => x.id), labels: Object.fromEntries(xs.map(x => [x.id, x.title])),
                rows: xs.map(x => (
                    <SortableLibraryRow key={x.id} id={x.id} title={x.title} subtitle={x.stack ?? ""} meta={range(x.startDate, x.endDate, x.isActive)} hiddenCount={hiddenCount(bulletEntries(bulletLines(x.description)), x.hidden)}
                        isSelected={x.isSelected} active={{ isActive: x.isActive, type: "project" }} tags={x.tags} usedBy={variantUsage[x.id]}
                        onUpdate={updateProject} onDelete={deleteProject}>
                        {x.link && <p className="break-all text-fg-muted">{x.link}</p>}
                        <SubItemToggles id={x.id} entries={bulletEntries(bulletLines(x.description))} hidden={x.hidden} onUpdate={updateProject} variant="bullets" />
                    </SortableLibraryRow>
                )),
            };
        },
        skills: () => {
            const xs = ordered("skills", lists.skills);
            return {
                ids: xs.map(x => x.id), labels: Object.fromEntries(xs.map(x => [x.id, x.category])),
                rows: xs.map(x => (
                    <SortableLibraryRow key={x.id} id={x.id} title={x.category} subtitle={visible(skillEntries(x.items), x.hidden).map(e => e.label).join(", ")}
                        hiddenCount={hiddenCount(skillEntries(x.items), x.hidden)} isSelected={x.isSelected} tags={x.tags} usedBy={variantUsage[x.id]}
                        onUpdate={updateSkill} onDelete={deleteSkill}>
                        <SubItemToggles id={x.id} entries={skillEntries(x.items)} hidden={x.hidden} onUpdate={updateSkill} variant="chips" />
                    </SortableLibraryRow>
                )),
            };
        },
        volunteering: () => {
            const xs = ordered("volunteering", lists.volunteering);
            return {
                ids: xs.map(x => x.id), labels: Object.fromEntries(xs.map(x => [x.id, x.role])),
                rows: xs.map(x => (
                    <SortableLibraryRow key={x.id} id={x.id} title={x.role} subtitle={x.organization} meta={range(x.startDate, x.endDate, x.isActive)} hiddenCount={hiddenCount(bulletEntries(bulletLines(x.description)), x.hidden)}
                        isSelected={x.isSelected} active={{ isActive: x.isActive, type: "volunteering" }} tags={x.tags} usedBy={variantUsage[x.id]}
                        onUpdate={updateVolunteering} onDelete={deleteVolunteering}>
                        <SubItemToggles id={x.id} entries={bulletEntries(bulletLines(x.description))} hidden={x.hidden} onUpdate={updateVolunteering} variant="bullets" />
                    </SortableLibraryRow>
                )),
            };
        },
        publications: () => {
            const xs = ordered("publications", lists.publications);
            return {
                ids: xs.map(x => x.id), labels: Object.fromEntries(xs.map(x => [x.id, x.title])),
                rows: xs.map(x => (
                    <SortableLibraryRow key={x.id} id={x.id} title={x.title} subtitle={[x.authors, x.venue].filter(Boolean).join(" · ")} meta={formatMonthYear(x.date)}
                        isSelected={x.isSelected} tags={x.tags} usedBy={variantUsage[x.id]} onUpdate={updatePublication} onDelete={deletePublication}>
                        {x.authors && <p className="text-fg-muted">{x.authors}</p>}
                        {x.venue && <p className="text-fg-muted">{x.venue}</p>}
                        {x.link && <p className="break-all text-fg-muted">{x.link}</p>}
                    </SortableLibraryRow>
                )),
            };
        },
        awards: () => {
            const xs = ordered("awards", lists.awards);
            return {
                ids: xs.map(x => x.id), labels: Object.fromEntries(xs.map(x => [x.id, x.title])),
                rows: xs.map(x => (
                    <SortableLibraryRow key={x.id} id={x.id} title={x.title} subtitle={x.issuer ?? ""} meta={formatMonthYear(x.date)}
                        isSelected={x.isSelected} tags={x.tags} usedBy={variantUsage[x.id]} onUpdate={updateAward} onDelete={deleteAward}>
                        {x.description && <p className="text-fg-muted leading-relaxed">{x.description}</p>}
                    </SortableLibraryRow>
                )),
            };
        },
        certifications: () => {
            const xs = ordered("certifications", lists.certifications);
            return {
                ids: xs.map(x => x.id), labels: Object.fromEntries(xs.map(x => [x.id, x.name])),
                rows: xs.map(x => (
                    <SortableLibraryRow key={x.id} id={x.id} title={x.name} subtitle={x.issuer ?? ""} meta={x.year}
                        isSelected={x.isSelected} tags={x.tags} usedBy={variantUsage[x.id]} onUpdate={updateCertification} onDelete={deleteCertification} />
                )),
            };
        },
        languages: () => {
            const xs = ordered("languages", lists.languages);
            return {
                ids: xs.map(x => x.id), labels: Object.fromEntries(xs.map(x => [x.id, x.language])),
                rows: xs.map(x => (
                    <SortableLibraryRow key={x.id} id={x.id} title={x.language} subtitle={x.proficiency ?? ""}
                        isSelected={x.isSelected} tags={x.tags} usedBy={variantUsage[x.id]} onUpdate={updateLanguage} onDelete={deleteLanguage} />
                )),
            };
        },
    };

    const section = (key: ResumeListKey, sortable: boolean) => {
        const { ids, labels, rows } = renderRows[key]();
        return (
            <SortableLibrarySection
                key={key} sectionKey={key} sortable={sortable} ids={ids} collapsed={draggingSection}
                sortByDate={hasManualOrder(layout, key) && isDatedSection(key) ? () => saveLayout(resetItemOrder(layout, key)) : undefined}
            >
                <SortableList ids={ids} labelOf={id => labels[id] || "item"} onMove={(activeId, overId) => saveLayout(moveItem(layout, key, ids, activeId, overId))}>
                    {rows}
                </SortableList>
            </SortableLibrarySection>
        );
    };

    // The summary has no library section; it keeps its place in the order.
    const visibleKeys = layout.sectionOrder.filter((id): id is ResumeListKey => id !== "summary" && show(id));

    if (tab !== "all") {
        return (
            <div className="space-y-8">
                {visibleKeys.map(key => (
                    <SortableList key={key} ids={[key]} labelOf={() => SECTION_LABEL[key]} onMove={() => {}}>{section(key, false)}</SortableList>
                ))}
            </div>
        );
    }
    return (
        <SortableList
            ids={visibleKeys}
            labelOf={id => SECTION_LABEL[id as ResumeListKey]}
            onDragStart={() => setDraggingSection(true)}
            onDragDone={() => setDraggingSection(false)}
            onMove={(activeId, overId) => saveLayout(moveSection(layout, activeId as SectionId, overId as SectionId))}
        >
            <div className="space-y-8">{visibleKeys.map(key => section(key, true))}</div>
        </SortableList>
    );
}

function SortableLibrarySection({ sectionKey, sortable, ids, collapsed, sortByDate, children }: {
    sectionKey: ResumeListKey;
    sortable: boolean;
    ids: string[];
    collapsed: boolean;
    sortByDate?: () => void;
    children: React.ReactNode;
}) {
    const title = SECTION_LABEL[sectionKey];
    const { rowRef, style, handle } = useSortableRow(sectionKey, title, !sortable);
    return (
        <LibrarySection
            icon={SECTION_ICON[sectionKey]} title={title} ids={ids} handle={handle} rowRef={rowRef} style={style} collapsed={collapsed}
            headerActions={sortByDate && <Button size="sm" variant="ghost" icon={ArrowDownWideNarrow} onClick={sortByDate}>Sort by date</Button>}
        >
            {children}
        </LibrarySection>
    );
}

function SortableLibraryRow(props: React.ComponentProps<typeof LibraryRow>) {
    const { rowRef, style, handle } = useSortableRow(props.id, props.title || "item");
    return <LibraryRow {...props} handle={handle} rowRef={rowRef} style={style} />;
}
