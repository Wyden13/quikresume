"use client";

import React from "react";
import type { ResumeListKey } from "@/types/schema";
import { RESUME_LIST_KEYS } from "@/types/schema";
import { SECTION_LABEL } from "@/lib/sections";
import { Tabs, type TabItem } from "@/components/ui/primitives/tabs";

export type SectionTab = ResumeListKey | "all" | "profile";

interface SectionTabsProps {
    counts: Partial<Record<ResumeListKey, number>>;
    value: SectionTab;
    onChange: (tab: SectionTab) => void;
    /** Editor: list every section (you need to reach empty ones to add items) and a Profile tab first. */
    showEmpty?: boolean;
    withProfile?: boolean;
}

/** Filter strip over the résumé sections, shared by Library and Editor. */
export function SectionTabs({ counts, value, onChange, showEmpty = false, withProfile = false }: SectionTabsProps) {
    const items: TabItem<SectionTab>[] = [{ value: "all", label: "All" }];
    if (withProfile) items.push({ value: "profile", label: "Profile" });
    for (const key of RESUME_LIST_KEYS) {
        const n = counts[key] ?? 0;
        if (n > 0 || showEmpty) items.push({ value: key, label: SECTION_LABEL[key], count: n });
    }
    return <Tabs items={items} value={value} onChange={onChange} aria-label="Sections" />;
}
