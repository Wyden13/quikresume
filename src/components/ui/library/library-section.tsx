"use client";

import React from "react";
import { expansion, useExpandedIds } from "@/lib/ui/expansion-store";
import { SectionHeader } from "@/components/ui/primitives/card";
import { Button } from "@/components/ui/primitives/button";
import type { LucideIcon } from "@/components/ui/primitives/icons";

export function LibrarySection({ icon, title, ids, children }: { icon: LucideIcon; title: string; ids: string[]; children: React.ReactNode }) {
    const expanded = useExpandedIds();
    const allOpen = ids.length > 0 && ids.every(id => expanded.has(id));
    return (
        <section className="space-y-2">
            <SectionHeader
                icon={icon}
                title={title}
                count={ids.length}
                action={
                    <Button size="sm" variant="ghost" onClick={() => (allOpen ? expansion.collapse(ids) : expansion.expand(ids))}>
                        {allOpen ? "Collapse all" : "Expand all"}
                    </Button>
                }
            />
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">{children}</ul>
        </section>
    );
}
