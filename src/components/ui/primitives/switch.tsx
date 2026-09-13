"use client";

import React from "react";
import { cn } from "@/lib/cn";
import { FOCUS_RING } from "./button";

interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
    checked: boolean;
    /** Omit when the switch submits a form (type="submit"). */
    onChange?: (checked: boolean) => void;
    pending?: boolean;
    label?: string;
}

/**
 * Visual toggle. Renders a <button role="switch">; pass type="submit" to use it
 * as the submit control of a server-action form (the library rows do this).
 */
export function Switch({ checked, onChange, pending, label, className, type = "button", disabled, ...rest }: SwitchProps) {
    return (
        <button
            type={type}
            role="switch"
            aria-checked={checked}
            aria-label={label}
            aria-busy={pending || undefined}
            disabled={disabled || pending}
            onClick={onChange ? () => onChange(!checked) : rest.onClick}
            className={cn(
                "relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full border transition-colors",
                checked ? "bg-accent border-accent" : "bg-surface-muted border-border-strong",
                "disabled:opacity-60 disabled:cursor-wait",
                FOCUS_RING,
                className,
            )}
            {...rest}
        >
            <span
                aria-hidden
                className={cn(
                    "absolute top-1/2 -translate-y-1/2 size-3.5 rounded-full bg-surface shadow-sm transition-transform",
                    checked ? "translate-x-[15px]" : "translate-x-[1px]",
                )}
            />
        </button>
    );
}
