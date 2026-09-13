"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

interface DialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    className?: string;
}

/** Modal on the native <dialog>: focus trap, scroll lock and Escape come for free. */
export function Dialog({ open, onClose, title, children, footer, className }: DialogProps) {
    const ref = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (open && !el.open) el.showModal();
        else if (!open && el.open) el.close();
    }, [open]);

    return (
        <dialog
            ref={ref}
            onCancel={e => { e.preventDefault(); onClose(); }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
            className={cn(
                "m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-border bg-surface p-0 text-fg shadow-lg",
                "backdrop:bg-black/35",
                className,
            )}
            aria-labelledby="dialog-title"
        >
            <div className="p-6">
                <h2 id="dialog-title" className="text-base font-semibold">{title}</h2>
                <div className="mt-2 space-y-2 text-sm text-fg-muted">{children}</div>
                {footer && <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
            </div>
        </dialog>
    );
}

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

export function ConfirmDialog({ open, title, children, confirmLabel = "Continue", cancelLabel = "Cancel", danger, busy, onConfirm, onCancel }: ConfirmDialogProps) {
    return (
        <Dialog
            open={open}
            onClose={() => { if (!busy) onCancel(); }}
            title={title}
            footer={
                <>
                    <Button variant="secondary" onClick={onCancel} disabled={busy}>{cancelLabel}</Button>
                    <Button variant="primary" onClick={onConfirm} loading={busy} className={danger ? "bg-danger hover:bg-danger/90" : undefined}>{confirmLabel}</Button>
                </>
            }
        >
            {children}
        </Dialog>
    );
}
