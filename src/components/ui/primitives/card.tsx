import React from "react";
import { cn } from "@/lib/cn";

export function Card({ className, children, as: Tag = "section" }: { className?: string; children: React.ReactNode; as?: "section" | "div" | "aside" | "li" }) {
    return <Tag className={cn("rounded-lg border border-border bg-surface", className)}>{children}</Tag>;
}

export function CardHeader({ title, hint, action, className }: { title: React.ReactNode; hint?: React.ReactNode; action?: React.ReactNode; className?: string }) {
    return (
        <div className={cn("flex items-start justify-between gap-3 px-4 pt-4 pb-3", className)}>
            <div className="min-w-0">
                <h3 className="text-[15px] font-semibold leading-tight text-fg">{title}</h3>
                {hint && <p className="mt-0.5 text-13 text-fg-muted">{hint}</p>}
            </div>
            {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </div>
    );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
    return <div className={cn("px-4 pb-4", className)}>{children}</div>;
}

/** Header row for a group of rows: icon + title + count + actions. */
export function SectionHeader({ icon: Icon, title, count, action, className }: { icon?: React.ComponentType<{ className?: string }>; title: string; count?: number; action?: React.ReactNode; className?: string }) {
    return (
        <div className={cn("flex h-10 items-center gap-2", className)}>
            {Icon && <Icon className="size-4 text-fg-subtle" />}
            <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
            {count !== undefined && <span className="rounded-sm bg-surface-muted px-1.5 text-xs font-medium text-fg-muted tabular-nums">{count}</span>}
            {action && <div className="ml-auto flex items-center gap-1">{action}</div>}
        </div>
    );
}
