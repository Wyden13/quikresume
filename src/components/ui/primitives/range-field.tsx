"use client";

import React from "react";
import { cn } from "@/lib/cn";

/** Slider + number box for one clamped numeric value. */
export function RangeField({ id, label, value, min, max, step, unit, onChange, className }: {
    id: string;
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit: string;
    onChange: (v: number) => void;
    className?: string;
}) {
    const clamp = (n: number) => Math.min(max, Math.max(min, n));
    return (
        <div className={cn("grid grid-cols-[minmax(0,1fr)_5.5rem] items-center gap-x-3 gap-y-1", className)}>
            <label htmlFor={id} className="col-span-2 text-13 font-medium text-fg-muted">{label}</label>
            <input
                type="range"
                aria-label={label}
                min={min} max={max} step={step} value={value}
                onChange={e => onChange(clamp(Number(e.target.value)))}
                className="h-9 w-full cursor-pointer accent-accent"
            />
            <div className="flex h-9 items-center rounded-md border border-border bg-surface pr-2 focus-within:border-fg">
                <input
                    id={id}
                    type="number"
                    min={min} max={max} step={step} value={value}
                    onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(clamp(n)); }}
                    className="h-full w-full min-w-0 bg-transparent px-2 text-sm tabular-nums text-fg focus:outline-none"
                />
                <span className="text-xs text-fg-subtle">{unit}</span>
            </div>
        </div>
    );
}
