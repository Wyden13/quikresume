"use client";

import React from "react";
import { PRESENT } from "@/lib/dates";
import { Checkbox, Input, Label } from "@/components/ui/primitives/field";

/** Start date + end date, with a "current" checkbox that stores endDate as "Present". */
export function DateRangeFields({ idPrefix, startDate, endDate, currentLabel, onChange }: {
    idPrefix: string;
    startDate: string;
    endDate: string;
    currentLabel: string;
    onChange: (patch: { startDate?: string; endDate?: string }) => void;
}) {
    const isCurrent = endDate === PRESENT;
    return (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div>
                <Label htmlFor={`${idPrefix}-start`}>Start date</Label>
                <Input id={`${idPrefix}-start`} type="date" value={startDate} onChange={(e) => onChange({ startDate: e.target.value })} />
            </div>
            <div>
                <Label htmlFor={`${idPrefix}-end`}>End date</Label>
                <Input id={`${idPrefix}-end`} type="date" value={isCurrent ? "" : endDate} disabled={isCurrent} onChange={(e) => onChange({ endDate: e.target.value })} />
            </div>
            <label className="flex h-9 cursor-pointer items-center gap-2 text-13 text-fg-muted">
                <Checkbox checked={isCurrent} onChange={(e) => onChange({ endDate: e.target.checked ? PRESENT : "" })} />
                {currentLabel}
            </label>
        </div>
    );
}
