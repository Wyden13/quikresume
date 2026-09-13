"use client";

import React from "react";
import { SectionHeader } from "@/components/ui/primitives/card";
import { Button } from "@/components/ui/primitives/button";
import { Plus, type LucideIcon } from "@/components/ui/primitives/icons";

export function EditorSection({ icon, title, count, addLabel, onAdd, children }: { icon: LucideIcon; title: string; count: number; addLabel: string; onAdd: () => void; children: React.ReactNode }) {
    return (
        <section className="space-y-2">
            <SectionHeader icon={icon} title={title} count={count} action={<Button size="sm" icon={Plus} onClick={onAdd}>{addLabel}</Button>} />
            {count === 0 ? (
                <div className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-13 text-fg-subtle">Nothing here yet.</div>
            ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">{children}</ul>
            )}
        </section>
    );
}
