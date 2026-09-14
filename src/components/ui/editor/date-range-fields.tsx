"use client";

import React from "react";
import { PRESENT } from "@/lib/dates";
import type { DateErrors } from "@/lib/validation/dates";
import { Checkbox, Label } from "@/components/ui/primitives/field";
import { MonthField } from "@/components/ui/primitives/month-field";

/** Start month + end month, with a "current" checkbox that stores endDate as "Present". Both are optional. */
export function DateRangeFields({ idPrefix, startDate, endDate, currentLabel, errors, onChange }: {
    idPrefix: string;
    startDate: string;
    endDate: string;
    currentLabel: string;
    errors?: DateErrors;
    onChange: (patch: { startDate?: string; endDate?: string }) => void;
}) {
    const isCurrent = endDate === PRESENT;
    return (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-[1fr_1fr_auto] md:items-start">
            <div>
                <Label htmlFor={`${idPrefix}-start`}>Start (optional)</Label>
                <MonthField id={`${idPrefix}-start`} value={startDate} invalid={Boolean(errors?.start)} onChange={v => onChange({ startDate: v })} />
                {errors?.start && <p className="mt-1 text-13 text-danger">{errors.start}</p>}
            </div>
            <div>
                <Label htmlFor={`${idPrefix}-end`}>End (optional)</Label>
                <MonthField id={`${idPrefix}-end`} value={isCurrent ? "" : endDate} disabled={isCurrent} invalid={Boolean(errors?.end)} onChange={v => onChange({ endDate: v })} />
                {errors?.end && <p className="mt-1 text-13 text-danger">{errors.end}</p>}
            </div>
            <label className="flex h-9 cursor-pointer items-center gap-2 text-13 text-fg-muted md:mt-[1.625rem]">
                <Checkbox checked={isCurrent} onChange={(e) => onChange({ endDate: e.target.checked ? PRESENT : "" })} />
                {currentLabel}
            </label>
        </div>
    );
}
