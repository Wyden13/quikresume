"use client";

import React from "react";
import { SectionHeader } from "@/components/ui/primitives/card";
import { Button } from "@/components/ui/primitives/button";
import { Plus, type LucideIcon } from "@/components/ui/primitives/icons";

export function EditorSection({ icon, title, count, addLabel, onAdd, handle, headerActions, layoutControls, collapsed, plain, rowRef, style, children }: {
    icon: LucideIcon;
    title: string;
    /** Item count; omitted for sections that are not a list (Summary). */
    count?: number;
    addLabel?: string;
    onAdd?: () => void;
    /** Drag handle for reordering sections. */
    handle?: React.ReactNode;
    /** Extra header buttons (e.g. "Sort by date"). */
    headerActions?: React.ReactNode;
    /** Advanced layout mode: section spacing controls under the header. */
    layoutControls?: React.ReactNode;
    /** Only the header is shown (while sections are being dragged). */
    collapsed?: boolean;
    /** Render `children` as-is instead of inside the item list. */
    plain?: boolean;
    rowRef?: React.Ref<HTMLElement>;
    style?: React.CSSProperties;
    /** Item rows (or any body when `plain`). */
    children: React.ReactNode;
}) {
    return (
        <section ref={rowRef} style={style} className="space-y-2 bg-bg">
            <div className="flex items-center gap-1">
                {handle}
                <SectionHeader
                    className="min-w-0 flex-1"
                    icon={icon}
                    title={title}
                    count={count}
                    action={<>{headerActions}{onAdd && addLabel && <Button size="sm" icon={Plus} onClick={onAdd}>{addLabel}</Button>}</>}
                />
            </div>
            {!collapsed && layoutControls}
            {collapsed ? null : plain ? children : count === 0 ? (
                <div className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-13 text-fg-subtle">Nothing here yet.</div>
            ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">{children}</ul>
            )}
        </section>
    );
}
