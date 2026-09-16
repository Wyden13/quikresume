"use client";

// Yellow "Action items" card at the top of the Library and the Editor. One collapsed tray per flagged
// item, built from the same dense rows as the Library: an item that is both too long and low-scoring
// appears once, with a badge per problem. Expanding spells the problems out and links into the editor.
// Renders nothing when there is nothing to fix.

import React, { useState } from "react";
import type { ResumeListKey } from "@/types/schema";
import { WORD_CAUTION, type OverCapItem } from "@/lib/text/word-count";
import type { InvalidDateItem } from "@/lib/validation/dates";
import { SECTION_LABEL } from "@/lib/sections";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives/card";
import { ExpandableRow } from "@/components/ui/primitives/expandable-row";
import { Badge, type BadgeTone } from "@/components/ui/primitives/badge";
import { Button } from "@/components/ui/primitives/button";
import { FLAG_LABEL } from "@/lib/review/types";
import type { LowScoreItem } from "@/lib/review/content";

/** "summary" opens the summary field, "profile" a personal info field (id "pi-<field>"). */
export type OpenItem = (section: ResumeListKey | "summary" | "profile", id: string) => void;

type Section = ResumeListKey | "summary";

interface Issue {
    tone: BadgeTone;
    /** Short label on the collapsed row. */
    badge: string;
    /** The problem spelled out, shown once the tray is open. */
    detail: string;
}

interface ActionItem {
    key: string;
    section: Section;
    id: string;
    label: string;
    issues: Issue[];
    /** Date errors block saving, so they sort first. */
    rank: number;
}

/** One tray per item, carrying every problem that item has. */
function collect(overCap: OverCapItem[], invalidDates: InvalidDateItem[], lowScore: LowScoreItem[]): ActionItem[] {
    const byKey = new Map<string, ActionItem>();
    const add = (section: Section, id: string, label: string, rank: number, issue: Issue) => {
        const key = `${section}-${id}`;
        const existing = byKey.get(key);
        if (existing) {
            existing.issues.push(issue);
            existing.rank = Math.min(existing.rank, rank);
            return;
        }
        byKey.set(key, { key, section, id, label, issues: [issue], rank });
    };

    for (const i of invalidDates) {
        add(i.section, i.id, i.label, 0, { tone: "danger", badge: "Check dates", detail: i.message });
    }
    for (const i of overCap) {
        add(i.section, i.id, i.label, 1, { tone: "warning", badge: `Too long · ${i.words}`, detail: `${i.words} words, past the ${WORD_CAUTION}-word caution. Trim the weakest bullets or switch them off.` });
    }
    for (const i of lowScore) {
        const flags = i.flags.map(f => FLAG_LABEL[f]).join(", ");
        add(i.section, i.id, i.label, 2, { tone: "warning", badge: `${i.score}/10`, detail: flags ? `Your coach flagged: ${flags}.` : "Your coach scored this low." });
    }

    return [...byKey.values()].sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label));
}

export function ActionItemsCard({ overCap, invalidDates, lowScore = [], onOpen }: { overCap: OverCapItem[]; invalidDates: InvalidDateItem[]; lowScore?: LowScoreItem[]; onOpen: OpenItem }) {
    // Tray state is local, not the shared expansion store: the card always opens collapsed.
    const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

    const items = collect(overCap, invalidDates, lowScore);
    if (items.length === 0) return null;

    const toggle = (key: string) => setOpen(prev => {
        const next = new Set(prev);
        if (!next.delete(key)) next.add(key);
        return next;
    });

    return (
        <Card className="@container border-warning-border bg-warning-bg/40">
            <CardHeader title="Action items" hint={`${items.length} ${items.length === 1 ? "item needs" : "items need"} your attention before this résumé is ready.`} />
            <CardBody>
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
                    {items.map(item => (
                        <ExpandableRow
                            key={item.key}
                            id={`action-${item.key}`}
                            open={open.has(item.key)}
                            onToggle={() => toggle(item.key)}
                            summary={
                                <div className="flex min-w-0 items-center gap-3">
                                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{item.label}</span>
                                    <span className="flex shrink-0 items-center gap-1">
                                        {item.issues.map(is => <Badge key={is.badge} tone={is.tone} size="xs" className="tabular-nums">{is.badge}</Badge>)}
                                    </span>
                                </div>
                            }
                        >
                            <div className="space-y-2 text-13">
                                <p className="text-fg-subtle">{item.section === "summary" ? "Profile" : SECTION_LABEL[item.section]}</p>
                                <ul className="space-y-1 text-fg-muted">
                                    {item.issues.map(is => <li key={is.badge}>{is.detail}</li>)}
                                </ul>
                                <Button size="sm" onClick={() => onOpen(item.section, item.id)}>Open in editor</Button>
                            </div>
                        </ExpandableRow>
                    ))}
                </ul>
            </CardBody>
        </Card>
    );
}
