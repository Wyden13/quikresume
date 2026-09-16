"use client";

// Yellow "Action items" card at the top of the Library and the Editor: items past the word caution,
// items whose dates don't add up and items the coach scored low. One collapsed row per kind of
// problem, built from the same dense rows as the Library; each entry opens the item in the editor.
// Renders nothing when there is nothing to fix.

import React, { useState } from "react";
import type { ResumeListKey } from "@/types/schema";
import { WORD_CAUTION, type OverCapItem } from "@/lib/text/word-count";
import type { InvalidDateItem } from "@/lib/validation/dates";
import { SECTION_LABEL } from "@/lib/sections";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives/card";
import { ExpandableRow } from "@/components/ui/primitives/expandable-row";
import { Badge, type BadgeTone } from "@/components/ui/primitives/badge";
import { FLAG_LABEL, LOW_SCORE } from "@/lib/review/types";
import type { LowScoreItem } from "@/lib/review/content";

/** "summary" opens the summary field, "profile" a personal info field (id "pi-<field>"). */
export type OpenItem = (section: ResumeListKey | "summary" | "profile", id: string) => void;

interface ActionEntry {
    section: ResumeListKey | "summary";
    id: string;
    label: string;
    detail: string;
}

export function ActionItemsCard({ overCap, invalidDates, lowScore = [], onOpen }: { overCap: OverCapItem[]; invalidDates: InvalidDateItem[]; lowScore?: LowScoreItem[]; onOpen: OpenItem }) {
    // Group state is local, not the shared expansion store: the card always opens collapsed.
    const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

    if (overCap.length === 0 && invalidDates.length === 0 && lowScore.length === 0) return null;
    const count = overCap.length + invalidDates.length + lowScore.length;

    const allGroups: { key: string; tone: BadgeTone; label: string; items: ActionEntry[] }[] = [
        { key: "long", tone: "warning", label: `Too long (over ${WORD_CAUTION} words)`, items: overCap.map(i => ({ ...i, detail: `${i.words} words` })) },
        { key: "score", tone: "warning", label: `Needs work (coach score ${LOW_SCORE} or less)`, items: lowScore.map(i => ({ ...i, detail: [`${i.score}/10`, ...i.flags.slice(0, 2).map(f => FLAG_LABEL[f])].join(" · ") })) },
        { key: "dates", tone: "danger", label: "Dates don't add up", items: invalidDates.map(i => ({ ...i, detail: i.message })) },
    ];
    const groups = allGroups.filter(g => g.items.length > 0);

    const toggle = (key: string) => setOpen(prev => {
        const next = new Set(prev);
        if (!next.delete(key)) next.add(key);
        return next;
    });

    return (
        <Card className="@container border-warning-border bg-warning-bg/40">
            <CardHeader title="Action items" hint={`${count} ${count === 1 ? "thing needs" : "things need"} your attention before this résumé is ready.`} />
            <CardBody>
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
                    {groups.map(g => (
                        <ExpandableRow
                            key={g.key}
                            id={`action-${g.key}`}
                            open={open.has(g.key)}
                            onToggle={() => toggle(g.key)}
                            summary={
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className="truncate text-sm font-medium text-fg">{g.label}</span>
                                    <Badge tone={g.tone} size="xs" className="tabular-nums">{g.items.length}</Badge>
                                </div>
                            }
                        >
                            <ItemLinks items={g.items} onOpen={onOpen} />
                        </ExpandableRow>
                    ))}
                </ul>
            </CardBody>
        </Card>
    );
}

function ItemLinks({ items, onOpen }: { items: ActionEntry[]; onOpen: OpenItem }) {
    return (
        <ul className="space-y-1 text-13">
            {items.map(i => (
                <li key={`${i.section}-${i.id}`} className="flex flex-wrap items-baseline gap-x-2">
                    <button type="button" onClick={() => onOpen(i.section, i.id)} className="font-medium text-fg underline underline-offset-2 hover:text-accent">
                        {i.label}
                    </button>
                    <span className="text-fg-muted">{i.section === "summary" ? "Profile" : SECTION_LABEL[i.section]} · {i.detail}</span>
                </li>
            ))}
        </ul>
    );
}
