"use client";

import React from "react";
import { cn } from "@/lib/cn";
import { FOCUS_RING } from "./button";

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
    return (
        <div role="radiogroup" className={cn("inline-flex h-8 items-center rounded-md bg-surface-muted p-0.5", className)}>
            {options.map(o => {
                const active = value === o.value;
                return (
                    <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onChange(o.value)}
                        className={cn(
                            "h-7 rounded-[5px] px-2.5 text-13 whitespace-nowrap transition-colors",
                            active ? "bg-surface text-fg font-medium shadow-sm" : "text-fg-muted hover:text-fg",
                            FOCUS_RING,
                        )}
                    >
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}
