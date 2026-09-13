import React from "react";
import { cn } from "@/lib/cn";

export function Table({ className, children }: { className?: string; children: React.ReactNode }) {
    return (
        <div className="overflow-x-auto">
            <table className={cn("w-full border-collapse text-13", className)}>{children}</table>
        </div>
    );
}

export function Th({ className, children, ...rest }: React.ThHTMLAttributes<HTMLTableCellElement>) {
    return <th {...rest} className={cn("border-b border-border px-3 py-2 text-left text-xs font-medium text-fg-muted whitespace-nowrap", className)}>{children}</th>;
}

export function Td({ className, children, ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) {
    return <td {...rest} className={cn("border-b border-border px-3 py-2 align-top", className)}>{children}</td>;
}
