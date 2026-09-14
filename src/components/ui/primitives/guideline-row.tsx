import React from "react";
import { cn } from "@/lib/cn";

/** Label + content row used by advice cards (Job Match Guidelines, Action items). The parent needs `@container`. */
export function GuidelineRow({ tone, label, children }: { tone: "danger" | "warning"; label: string; children: React.ReactNode }) {
    return (
        <div className="grid gap-1 @xl:grid-cols-[12rem_minmax(0,1fr)] @xl:gap-3">
            <p className={cn("text-xs font-medium", tone === "danger" ? "text-danger" : "text-warning")}>{label}</p>
            <div className="text-fg">{children}</div>
        </div>
    );
}
