// src/components/ui/confirm-dialog.tsx
"use client";

import React, { useEffect } from "react";
import { Button } from "@/components/ui/form-controls";

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    children: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    busy?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

/** Modal confirmation. Escape cancels; the backdrop click cancels. */
export function ConfirmDialog({ open, title, children, confirmLabel = "Continue", cancelLabel = "Cancel", danger, busy, onConfirm, onCancel }: ConfirmDialogProps) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onCancel]);

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onCancel} role="presentation">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-title"
                onClick={e => e.stopPropagation()}
                className="w-full max-w-lg bg-white rounded-[2rem] border-2 border-black/5 shadow-2xl p-6 md:p-8 space-y-6"
            >
                <h2 id="confirm-title" className="text-xl font-black tracking-tight">{title}</h2>
                <div className="text-sm text-black/70 font-medium space-y-3">{children}</div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                    <Button variant="default" onClick={onCancel} disabled={busy}>{cancelLabel}</Button>
                    <Button variant="primary" onClick={onConfirm} loading={busy} className={danger ? "!bg-red-600 hover:!bg-red-700" : ""}>{confirmLabel}</Button>
                </div>
            </div>
        </div>
    );
}
