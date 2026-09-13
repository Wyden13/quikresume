"use client";

// The Master Editor: a controlled form over ResumeData. Items are collapsible
// rows; new items open and scroll into view. Saving lives in the top bar
// (dashboard-client.tsx), so this component only edits the draft.

import React, { useState } from "react";
import type { ResumeData, ResumeListKey } from "@/types/schema";
import { isTempId } from "@/lib/ids";
import { isStale } from "@/lib/tags/content";
import { itemLabel, SECTION_LABEL } from "@/lib/sections";
import type { SectionTab } from "@/components/ui/section-tabs";
import { LIBRARY_ORDER, SECTION_ICON } from "@/components/ui/library/library-view";
import { NoticeBanner } from "@/components/ui/primitives/notice-banner";
import { PersonalInfoSection } from "./personal-info-section";
import { EditorSection } from "./editor-section";
import { EditorItemRow } from "./editor-item-row";
import { SECTION_CONFIG } from "./section-fields";

type ItemOf<K extends ResumeListKey> = ResumeData[K][number];

interface ResumeFormProps {
    resumeData: ResumeData;
    /** Functional updater so edits never depend on a stale snapshot. */
    onChange: (updater: (prev: ResumeData) => ResumeData) => void;
    /** Item id -> names of saved variants that include it. */
    variantUsage?: Record<string, string[]>;
    /** Which section to show ("all" shows everything). */
    tab: SectionTab;
}

export function ResumeForm({ resumeData, onChange, variantUsage = {}, tab }: ResumeFormProps) {
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set());
    const [justAddedId, setJustAddedId] = useState<string | null>(null);

    const toggleOpen = (id: string) => setOpenIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

    const updatePersonalInfo = (field: keyof ResumeData["personalInfo"], value: string) => {
        onChange(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, [field]: value } }));
    };

    const addItem = <K extends ResumeListKey>(key: K) => {
        const item = SECTION_CONFIG[key].create() as ItemOf<K>;
        onChange(prev => ({ ...prev, [key]: [...prev[key], item] }));
        setOpenIds(prev => new Set(prev).add(item.id));
        setJustAddedId(item.id);
    };

    const updateItem = <K extends ResumeListKey>(key: K, id: string, patch: Partial<ItemOf<K>>) => {
        onChange(prev => ({
            ...prev,
            [key]: (prev[key] as ItemOf<K>[]).map(item => (item.id === id ? { ...item, ...patch } : item)),
        }));
    };

    // Deletion is immediate for persisted items; adds/edits persist on Save & Exit.
    const removeItem = async <K extends ResumeListKey>(key: K, id: string) => {
        if (!isTempId(id)) {
            try {
                await SECTION_CONFIG[key].remove(id);
                setDeleteError(null);
            } catch (err) {
                console.error("Failed to delete item:", err);
                setDeleteError("Could not delete this item. Please try again.");
                return;
            }
        }
        onChange(prev => ({ ...prev, [key]: (prev[key] as ItemOf<K>[]).filter(item => item.id !== id) }));
    };

    const renderSection = <K extends ResumeListKey>(key: K) => {
        const cfg = SECTION_CONFIG[key];
        const items = resumeData[key] as ItemOf<K>[];
        return (
            <EditorSection key={key} icon={SECTION_ICON[key]} title={SECTION_LABEL[key]} count={items.length} addLabel={cfg.addLabel} onAdd={() => addItem(key)}>
                {items.map(item => {
                    const label = itemLabel(key, item);
                    return (
                        <EditorItemRow
                            key={item.id}
                            id={item.id}
                            title={label.title}
                            subtitle={label.subtitle}
                            meta={label.meta}
                            isSelected={item.isSelected}
                            onToggleSelected={checked => updateItem(key, item.id, { isSelected: checked } as Partial<ItemOf<K>>)}
                            onRemove={() => void removeItem(key, item.id)}
                            usedBy={variantUsage[item.id] ?? []}
                            stale={isStale(key, item)}
                            open={openIds.has(item.id)}
                            onToggleOpen={() => toggleOpen(item.id)}
                            autoFocus={item.id === justAddedId}
                        >
                            {cfg.fields(item, patch => updateItem(key, item.id, patch))}
                        </EditorItemRow>
                    );
                })}
            </EditorSection>
        );
    };

    const sections = tab === "all" ? LIBRARY_ORDER : tab === "profile" ? [] : [tab];

    return (
        <div className="space-y-8">
            {deleteError && <NoticeBanner tone="danger" onDismiss={() => setDeleteError(null)}>{deleteError}</NoticeBanner>}
            {(tab === "all" || tab === "profile") && <PersonalInfoSection value={resumeData.personalInfo} onChange={updatePersonalInfo} />}
            {sections.map(key => renderSection(key))}
        </div>
    );
}
