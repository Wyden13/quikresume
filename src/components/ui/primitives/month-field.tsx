"use client";

// Month + year picker built from two selects. <input type="month"> is not
// supported by desktop Firefox / Safari. Value: "YYYY-MM-01" | "".

import React, { useState } from "react";
import { cn } from "@/lib/cn";
import { MONTH_NAMES, monthValue, parseDateParts } from "@/lib/dates";
import { Select } from "./field";

const FIRST_YEAR = 1950;

export function MonthField({ id, value, onChange, disabled, invalid, className }: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    invalid?: boolean;
    className?: string;
}) {
    const parts = parseDateParts(value);
    // A half-picked date (month without year or the reverse) lives here until both are set.
    const [pending, setPending] = useState<{ m: number | null; y: number | null }>({ m: null, y: null });
    const month = parts?.m ?? pending.m;
    const year = parts?.y ?? pending.y;
    const lastYear = new Date().getFullYear() + 10;
    const years: number[] = [];
    for (let y = lastYear; y >= FIRST_YEAR; y--) years.push(y);

    const pick = (m: number | null, y: number | null) => {
        if (m !== null && y !== null) {
            setPending({ m: null, y: null });
            onChange(monthValue(y, m));
        } else {
            setPending({ m, y });
            if (value) onChange("");
        }
    };

    const control = invalid ? "border-danger hover:border-danger" : undefined;
    return (
        <div className={cn("grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-2", className)}>
            <Select id={id} aria-label="Month" value={month ?? ""} disabled={disabled} selectClassName={control}
                onChange={e => pick(e.target.value ? Number(e.target.value) : null, year)}>
                <option value="">Month</option>
                {MONTH_NAMES.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
            </Select>
            <Select aria-label="Year" value={year ?? ""} disabled={disabled} selectClassName={control}
                onChange={e => pick(month, e.target.value ? Number(e.target.value) : null)}>
                <option value="">Year</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
            </Select>
        </div>
    );
}
