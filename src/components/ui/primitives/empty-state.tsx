import React from "react";
import { cn } from "@/lib/cn";
import type { LucideIcon } from "./icons";

export function EmptyState({ icon: Icon, title, body, actions, className }: { icon?: LucideIcon; title: string; body?: string; actions?: React.ReactNode; className?: string }) {
    return (
        <div className={cn("flex flex-col items-center rounded-lg border border-dashed border-border-strong bg-surface px-6 py-12 text-center", className)}>
            {Icon && (
                <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-surface-muted">
                    <Icon className="size-5 text-fg-subtle" />
                </div>
            )}
            <p className="text-[15px] font-semibold text-fg">{title}</p>
            {body && <p className="mt-1 max-w-sm text-13 text-fg-muted">{body}</p>}
            {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
        </div>
    );
}
