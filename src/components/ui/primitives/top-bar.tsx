"use client";

import React from "react";
import { cn } from "@/lib/cn";
import { IconButton } from "./button";
import { Menu } from "./icons";
import { useShell } from "@/components/shell/shell-context";

interface TopBarProps {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    actions?: React.ReactNode;
    /** Second row (e.g. section tabs). */
    tabs?: React.ReactNode;
    /** Third row (e.g. the job context strip). */
    banner?: React.ReactNode;
    className?: string;
}

/** Sticky header of a content column. Includes the mobile menu button. */
export function TopBar({ title, subtitle, actions, tabs, banner, className }: TopBarProps) {
    const shell = useShell();
    return (
        <header className={cn("sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur", className)}>
            <div className="flex h-14 items-center gap-3 px-4 md:px-6">
                {shell && <IconButton icon={Menu} aria-label="Open navigation" className="lg:hidden -ml-1" onClick={shell.openDrawer} />}
                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-lg font-semibold leading-tight text-fg">{title}</h1>
                    {subtitle && <p className="truncate text-13 text-fg-muted">{subtitle}</p>}
                </div>
                {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
            </div>
            {tabs && <div className="border-t border-border/60 px-4 md:px-6">{tabs}</div>}
            {banner}
        </header>
    );
}
