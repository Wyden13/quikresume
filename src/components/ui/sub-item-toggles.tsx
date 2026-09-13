"use client";

// Individually switchable bullets / skills. Presentational: the Library wires
// it to a server action, the Editor to the draft.

import React from "react";
import { cn } from "@/lib/cn";
import type { SubItem } from "@/lib/sub-items";
import { FOCUS_RING } from "@/components/ui/primitives/button";
import { Checkbox } from "@/components/ui/primitives/field";

interface SubItemListProps {
    entries: SubItem[];
    hidden: readonly string[];
    onToggle: (key: string) => void;
    variant: "bullets" | "chips";
    /** Prefix for input ids (must be unique on the page). */
    idPrefix: string;
    disabled?: boolean;
    className?: string;
}

export function SubItemList({ entries, hidden, onToggle, variant, idPrefix, disabled, className }: SubItemListProps) {
    if (entries.length === 0) return null;
    const off = new Set(hidden);
    const shown = entries.filter(e => !off.has(e.key)).length;
    const noun = variant === "bullets" ? "bullets" : "skills";
    // Duplicate lines share a key; render each once.
    const unique = entries.filter((e, i) => entries.findIndex(x => x.key === e.key) === i);

    return (
        <div className={cn("space-y-2", className)}>
            {variant === "bullets" ? (
                <ul className="space-y-1">
                    {unique.map((e, i) => {
                        const on = !off.has(e.key);
                        const id = `${idPrefix}-b${i}`;
                        return (
                            <li key={e.key} className="flex items-start gap-2.5">
                                <Checkbox id={id} checked={on} onChange={() => onToggle(e.key)} disabled={disabled} className="mt-0.5" />
                                <label htmlFor={id} className={cn("cursor-pointer leading-relaxed", on ? "text-fg-muted" : "text-fg-subtle line-through decoration-fg-subtle/60")}>
                                    {e.label}
                                </label>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <div className="flex flex-wrap gap-1.5">
                    {unique.map(e => {
                        const on = !off.has(e.key);
                        return (
                            <button
                                key={e.key}
                                type="button"
                                aria-pressed={on}
                                onClick={() => onToggle(e.key)}
                                disabled={disabled}
                                title={on ? "Shown on résumé · click to hide" : "Hidden · click to show"}
                                className={cn(
                                    "inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-medium transition-colors",
                                    on
                                        ? "border-border-strong bg-surface text-fg hover:bg-surface-hover"
                                        : "border-dashed border-border bg-transparent text-fg-subtle line-through hover:text-fg-muted",
                                    FOCUS_RING,
                                )}
                            >
                                {e.label}
                            </button>
                        );
                    })}
                </div>
            )}
            {shown < unique.length && (
                <p className="text-xs text-fg-subtle">{shown} of {unique.length} {noun} shown on résumé</p>
            )}
        </div>
    );
}
