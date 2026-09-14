"use client";

// Yellow "Action items" card at the top of the Library and the Editor: items
// past the word caution and items whose dates don't add up. Each row opens
// the item in the editor. Renders nothing when there is nothing to fix.

import React from "react";
import type { ResumeListKey } from "@/types/schema";
import { WORD_CAUTION, type OverCapItem } from "@/lib/text/word-count";
import type { InvalidDateItem } from "@/lib/validation/dates";
import { SECTION_LABEL } from "@/lib/sections";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives/card";
import { GuidelineRow } from "@/components/ui/primitives/guideline-row";

export type OpenItem = (section: ResumeListKey | "summary", id: string) => void;

export function ActionItemsCard({ overCap, invalidDates, onOpen }: { overCap: OverCapItem[]; invalidDates: InvalidDateItem[]; onOpen: OpenItem }) {
    if (overCap.length === 0 && invalidDates.length === 0) return null;
    const count = overCap.length + invalidDates.length;
    return (
        <Card className="@container border-warning-border bg-warning-bg/40">
            <CardHeader title="Action items" hint={`${count} ${count === 1 ? "thing needs" : "things need"} your attention before this résumé is ready.`} />
            <CardBody className="space-y-3 text-13">
                {overCap.length > 0 && (
                    <GuidelineRow tone="warning" label={`Too long (over ${WORD_CAUTION} words)`}>
                        <ItemLinks items={overCap.map(i => ({ ...i, detail: `${i.words} words` }))} onOpen={onOpen} />
                    </GuidelineRow>
                )}
                {invalidDates.length > 0 && (
                    <GuidelineRow tone="danger" label="Dates don't add up">
                        <ItemLinks items={invalidDates.map(i => ({ ...i, detail: i.message }))} onOpen={onOpen} />
                    </GuidelineRow>
                )}
            </CardBody>
        </Card>
    );
}

function ItemLinks({ items, onOpen }: { items: { section: ResumeListKey | "summary"; id: string; label: string; detail: string }[]; onOpen: OpenItem }) {
    return (
        <ul className="space-y-1">
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
