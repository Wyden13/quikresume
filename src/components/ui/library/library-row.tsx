"use client";

import React from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";
import type { Tag } from "@/lib/tags/types";
import { expansion, useExpandedIds } from "@/lib/ui/expansion-store";
import { ExpandableRow } from "@/components/ui/primitives/expandable-row";
import { Switch } from "@/components/ui/primitives/switch";
import { Badge, TagChip } from "@/components/ui/primitives/badge";
import { Button } from "@/components/ui/primitives/button";
import { Trash2 } from "@/components/ui/primitives/icons";

export type ServerAction = (id: string, formData: FormData) => Promise<void>;

export const ACTIVE_LABEL = {
    experience: "Currently here",
    education: "Currently enrolled",
    project: "Ongoing",
    volunteering: "Currently volunteering",
} as const;
export type ActiveType = keyof typeof ACTIVE_LABEL;

export interface LibraryRowProps {
    id: string;
    title: string;
    subtitle?: string;
    /** Right-aligned meta (date range, year). */
    meta?: string;
    isSelected: boolean;
    /** Present only for dated sections. */
    active?: { isActive: boolean; type: ActiveType };
    tags?: Tag[];
    usedBy?: string[];
    onUpdate: ServerAction;
    onDelete: (id: string) => Promise<void>;
    /** Expanded content (bullets, details). */
    children?: React.ReactNode;
}

const MAX_SUMMARY_TAGS = 3;

export function LibraryRow({ id, title, subtitle, meta, isSelected, active, tags = [], usedBy = [], onUpdate, onDelete, children }: LibraryRowProps) {
    const open = useExpandedIds().has(id);

    const summary = (
        <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-baseline gap-2">
                    <span className={cn("truncate text-sm font-medium", isSelected ? "text-fg" : "text-fg-muted")}>{title || <span className="text-fg-subtle">Untitled</span>}</span>
                    {subtitle && <span className="hidden truncate text-13 text-fg-muted md:inline">{subtitle}</span>}
                </div>
                {subtitle && <div className="truncate text-13 text-fg-muted md:hidden">{subtitle}</div>}
                {meta && <div className="text-xs text-fg-subtle md:hidden">{meta}</div>}
            </div>
            {(tags.length > 0 || usedBy.length > 0) && (
                <div className="hidden shrink-0 items-center gap-1 lg:flex">
                    {usedBy.length > 0 && <Badge title={usedBy.join(", ")}>{usedBy.length} {usedBy.length === 1 ? "variant" : "variants"}</Badge>}
                    {tags.slice(0, MAX_SUMMARY_TAGS).map(t => <TagChip key={t.name} tag={t} />)}
                    {tags.length > MAX_SUMMARY_TAGS && <span className="text-xs text-fg-subtle">+{tags.length - MAX_SUMMARY_TAGS}</span>}
                </div>
            )}
            {meta && <span className="hidden w-32 shrink-0 text-right text-13 tabular-nums text-fg-subtle md:inline">{meta}</span>}
        </div>
    );

    const controls = (
        <>
            {active?.isActive && <span title={ACTIVE_LABEL[active.type]} aria-label={ACTIVE_LABEL[active.type]} className="size-1.5 rounded-full bg-success" />}
            <form action={onUpdate.bind(null, id)} className="flex">
                <input type="hidden" name="isSelected" value={(!isSelected).toString()} />
                <PendingSwitch checked={isSelected} label={isSelected ? "Included on résumé" : "Not on résumé"} />
            </form>
        </>
    );

    return (
        <ExpandableRow id={`row-${id}`} open={open} onToggle={() => expansion.toggle(id)} summary={summary} controls={controls} muted={!isSelected}>
            <div className="space-y-3 text-13">
                {children}
                {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {tags.map(t => <TagChip key={t.name} tag={t} />)}
                    </div>
                )}
                {usedBy.length > 0 && <p className="text-xs text-fg-subtle">Used in {usedBy.join(", ")}</p>}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                    {active && (
                        <form action={onUpdate.bind(null, id)}>
                            <input type="hidden" name="isActive" value={(!active.isActive).toString()} />
                            <PendingButton>{active.isActive ? `${ACTIVE_LABEL[active.type]} · mark finished` : `Mark as ${ACTIVE_LABEL[active.type].toLowerCase()}`}</PendingButton>
                        </form>
                    )}
                    <form action={onDelete.bind(null, id)} className="ml-auto">
                        <PendingButton variant="danger" icon={Trash2}>Delete</PendingButton>
                    </form>
                </div>
            </div>
        </ExpandableRow>
    );
}

function PendingSwitch({ checked, label }: { checked: boolean; label: string }) {
    const { pending } = useFormStatus();
    return <Switch type="submit" checked={checked} pending={pending} label={label} />;
}

function PendingButton({ children, variant = "secondary", icon }: { children: React.ReactNode; variant?: "secondary" | "danger"; icon?: React.ComponentProps<typeof Button>["icon"] }) {
    const { pending } = useFormStatus();
    return <Button type="submit" size="sm" variant={variant} icon={icon} loading={pending}>{children}</Button>;
}

export function Bullets({ items }: { items: string[] }) {
    if (items.length === 0) return null;
    return (
        <ul className="list-disc space-y-1 pl-4 text-fg-muted marker:text-fg-subtle">
            {items.map((line, i) => <li key={i} className="leading-relaxed">{line}</li>)}
        </ul>
    );
}

export function Detail({ label, value }: { label: string; value?: string | null }) {
    if (!value) return null;
    return (
        <span className="inline-flex items-center gap-1.5 rounded-sm bg-surface-muted px-1.5 py-0.5 text-xs">
            <span className="text-fg-subtle">{label}</span>
            <span className="font-medium text-fg">{value}</span>
        </span>
    );
}
