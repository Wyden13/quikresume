"use client";

// The Master Editor: a controlled form over ResumeData. Items are collapsible
// rows; new items open and scroll into view. Saving lives in the top bar
// (dashboard-client.tsx), so this component only edits the draft.
//
// Order is the print order: sections follow `layout.sectionOrder` and items
// `orderedItems` (newest first until dragged). Dragging edits `draft.layout`.
// Advanced layout mode adds page, section and item spacing controls.

import React, { useState } from "react";
import type { ResumeData, ResumeListKey } from "@/types/schema";
import { isTempId } from "@/lib/ids";
import { isStale } from "@/lib/tags/content";
import { itemTitle, itemLabel, SECTION_LABEL } from "@/lib/sections";
import { itemWordCount } from "@/lib/text/word-count";
import { validateItemDates } from "@/lib/validation/dates";
import { hasManualOrder, isDatedSection, moveItem, moveSection, orderedItems, resetItemOrder } from "@/lib/layout/order";
import { ENTRY_SECTIONS } from "@/lib/layout/presets";
import type { ResumeLayout, SectionId } from "@/lib/layout/types";
import { useAdvancedLayout } from "@/lib/ui/advanced-layout-store";
import type { SectionTab } from "@/components/ui/section-tabs";
import { SECTION_ICON } from "@/components/ui/library/library-view";
import { NoticeBanner } from "@/components/ui/primitives/notice-banner";
import { Button } from "@/components/ui/primitives/button";
import { ArrowDownWideNarrow, User } from "@/components/ui/primitives/icons";
import { SortableList, useSortableRow } from "@/components/ui/primitives/sortable";
import { PersonalInfoSection, SummaryField } from "./personal-info-section";
import { EditorSection } from "./editor-section";
import { EditorItemRow } from "./editor-item-row";
import { SECTION_CONFIG } from "./section-fields";
import { ItemLayoutControls, PageLayoutCard, SectionLayoutControls, type LayoutUpdate } from "./layout-controls";

type ItemOf<K extends ResumeListKey> = ResumeData[K][number];

interface ResumeFormProps {
    resumeData: ResumeData;
    /** Functional updater so edits never depend on a stale snapshot. */
    onChange: (updater: (prev: ResumeData) => ResumeData) => void;
    /** Item id -> names of saved variants that include it. */
    variantUsage?: Record<string, string[]>;
    /** Which section to show ("all" shows everything). */
    tab: SectionTab;
    /** Item to open and scroll to on mount (Action items links remount the form with this). "summary" = the summary field. */
    initialOpenId?: string | null;
}

export const sectionTitle = (id: SectionId) => (id === "summary" ? "Summary" : SECTION_LABEL[id]);

export function ResumeForm({ resumeData, onChange, variantUsage = {}, tab, initialOpenId = null }: ResumeFormProps) {
    const advanced = useAdvancedLayout();
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set(initialOpenId ? [initialOpenId] : []));
    const [justAddedId, setJustAddedId] = useState<string | null>(initialOpenId);
    const [draggingSection, setDraggingSection] = useState(false);
    const layout = resumeData.layout;

    const toggleOpen = (id: string) => setOpenIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

    const updateLayout: LayoutUpdate = fn => onChange(prev => ({ ...prev, layout: fn(prev.layout) }));

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

    const sectionProps = { layout, advanced, collapsed: draggingSection, updateLayout };

    const renderSection = (id: SectionId, sortable: boolean) => {
        if (id === "summary") {
            return (
                <SortableSection key={id} id={id} sortable={sortable} icon={User} {...sectionProps}>
                    <SummaryField value={resumeData.personalInfo} onChange={updatePersonalInfo} autoFocus={initialOpenId === "summary"} />
                </SortableSection>
            );
        }
        const key = id;
        const cfg = SECTION_CONFIG[key];
        const items = orderedItems(key, resumeData[key] as ItemOf<typeof key>[], layout);
        const ids = items.map(it => it.id);
        const manual = hasManualOrder(layout, key);
        return (
            <SortableSection
                key={key} id={key} sortable={sortable} icon={SECTION_ICON[key]} count={items.length} addLabel={cfg.addLabel} onAdd={() => addItem(key)}
                headerActions={manual && isDatedSection(key) && (
                    <Button size="sm" variant="ghost" icon={ArrowDownWideNarrow} onClick={() => updateLayout(l => resetItemOrder(l, key))} title="Newest first: current, then most recently ended">
                        Sort by date
                    </Button>
                )}
                {...sectionProps}
            >
                <SortableList
                    ids={ids}
                    labelOf={itemId => { const it = items.find(x => x.id === itemId); return it ? itemTitle(key, it) : "item"; }}
                    onMove={(activeId, overId) => updateLayout(l => moveItem(l, key, ids, activeId, overId))}
                >
                    {items.map(item => (
                        <SortableItemRow
                            key={item.id}
                            sectionKey={key}
                            item={item}
                            layout={layout}
                            advanced={advanced && ENTRY_SECTIONS.has(key)}
                            usedBy={variantUsage[item.id] ?? []}
                            open={openIds.has(item.id)}
                            onToggleOpen={() => toggleOpen(item.id)}
                            autoFocus={item.id === justAddedId}
                            onUpdate={patch => updateItem(key, item.id, patch)}
                            onRemove={() => void removeItem(key, item.id)}
                            updateLayout={updateLayout}
                        />
                    ))}
                </SortableList>
            </SortableSection>
        );
    };

    const showProfile = tab === "all" || tab === "profile";

    return (
        <div className="space-y-8">
            {deleteError && <NoticeBanner tone="danger" onDismiss={() => setDeleteError(null)}>{deleteError}</NoticeBanner>}
            {advanced && <PageLayoutCard layout={layout} onChange={updateLayout} />}
            {showProfile && <PersonalInfoSection value={resumeData.personalInfo} onChange={updatePersonalInfo} />}
            {tab === "all" ? (
                <SortableList
                    ids={layout.sectionOrder}
                    labelOf={id => sectionTitle(id as SectionId)}
                    onDragStart={() => setDraggingSection(true)}
                    onDragDone={() => setDraggingSection(false)}
                    onMove={(activeId, overId) => updateLayout(l => moveSection(l, activeId as SectionId, overId as SectionId))}
                >
                    <div className="space-y-8">{layout.sectionOrder.map(id => renderSection(id, true))}</div>
                </SortableList>
            ) : (
                // A one-section tab has nothing to reorder against, but its rows still sit in a sortable context.
                <SortableList ids={[tab === "profile" ? "summary" : tab]} labelOf={id => sectionTitle(id as SectionId)} onMove={() => {}}>
                    {renderSection(tab === "profile" ? "summary" : tab, false)}
                </SortableList>
            )}
        </div>
    );
}

function SortableSection({ id, sortable, icon, count, addLabel, onAdd, headerActions, layout, advanced, collapsed, updateLayout, children }: {
    id: SectionId;
    sortable: boolean;
    icon: React.ComponentProps<typeof EditorSection>["icon"];
    count?: number;
    addLabel?: string;
    onAdd?: () => void;
    headerActions?: React.ReactNode;
    layout: ResumeLayout;
    advanced: boolean;
    collapsed: boolean;
    updateLayout: LayoutUpdate;
    children: React.ReactNode;
}) {
    const title = sectionTitle(id);
    const { rowRef, style, handle } = useSortableRow(id, title, !sortable);
    return (
        <EditorSection
            icon={icon} title={title} count={count} addLabel={addLabel} onAdd={onAdd}
            handle={handle} headerActions={headerActions} rowRef={rowRef} style={style}
            collapsed={collapsed} plain={id === "summary"}
            layoutControls={advanced && <SectionLayoutControls layout={layout} id={id} onChange={updateLayout} />}
        >
            {children}
        </EditorSection>
    );
}

function SortableItemRow<K extends ResumeListKey>({ sectionKey, item, layout, advanced, usedBy, open, onToggleOpen, autoFocus, onUpdate, onRemove, updateLayout }: {
    sectionKey: K;
    item: ItemOf<K>;
    layout: ResumeLayout;
    advanced: boolean;
    usedBy: string[];
    open: boolean;
    onToggleOpen: () => void;
    autoFocus: boolean;
    onUpdate: (patch: Partial<ItemOf<K>>) => void;
    onRemove: () => void;
    updateLayout: LayoutUpdate;
}) {
    const label = itemLabel(sectionKey, item);
    const errors = validateItemDates(sectionKey, item);
    const { rowRef, style, handle } = useSortableRow(item.id, itemTitle(sectionKey, item));
    return (
        <EditorItemRow
            id={item.id}
            title={label.title}
            subtitle={label.subtitle}
            meta={label.meta}
            isSelected={item.isSelected}
            onToggleSelected={checked => onUpdate({ isSelected: checked } as Partial<ItemOf<K>>)}
            onRemove={onRemove}
            usedBy={usedBy}
            stale={isStale(sectionKey, item)}
            words={itemWordCount(sectionKey, item)}
            dateError={errors.start ?? errors.end ?? errors.date}
            open={open}
            onToggleOpen={onToggleOpen}
            autoFocus={autoFocus}
            handle={handle}
            rowRef={rowRef}
            style={style}
        >
            {SECTION_CONFIG[sectionKey].fields(item, onUpdate, errors)}
            {advanced && (
                <div className="space-y-2">
                    <p className="text-13 font-medium text-fg-muted">Layout for this item</p>
                    <ItemLayoutControls layout={layout} id={item.id} onChange={updateLayout} />
                </div>
            )}
        </EditorItemRow>
    );
}
