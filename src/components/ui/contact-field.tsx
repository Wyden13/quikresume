"use client";

// One contact input of the résumé header (Profile page and editor): normalises on blur, shows the format
// issue under the field, and a red mark when the last link check found the link broken.

import React, { useState } from "react";
import type { PersonalInfo } from "@/types/schema";
import { isContactField, normalizeField } from "@/lib/contact/normalize";
import { brokenLink, type LinkChecks } from "@/lib/contact/types";
import { Field, Input } from "@/components/ui/primitives/field";
import { CircleAlert } from "@/components/ui/primitives/icons";

interface ContactInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "id"> {
    field: keyof PersonalInfo;
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    linkChecks?: LinkChecks;
    className?: string;
    inputRef?: React.Ref<HTMLInputElement>;
}

export function ContactInput({ field, id, label, value, onChange, linkChecks, className, inputRef, onBlur, ...rest }: ContactInputProps) {
    // Issues show once the field has been left (or when it arrives filled in), not while typing a first value.
    const [touched, setTouched] = useState(value !== "");
    const contact = isContactField(field);
    const result = contact && value ? normalizeField(field, value) : null;
    const show = touched && result && result.level !== "ok";
    const broken = field === "github" || field === "linkedin" || field === "website" ? brokenLink(linkChecks, field, value) : null;

    return (
        <Field
            label={label}
            htmlFor={id}
            className={className}
            error={show && result.level === "error" ? result.message : broken ? broken.detail ?? "This link could not be found." : undefined}
            warning={show && result.level === "warning" ? result.message : undefined}
            hint={show && result.level === "note" ? result.message : undefined}
        >
            <div className="relative">
                <Input
                    ref={inputRef}
                    id={id}
                    value={value}
                    aria-invalid={(show && result.level === "error") || Boolean(broken) || undefined}
                    className={broken ? "pr-9" : undefined}
                    onChange={e => onChange(e.target.value)}
                    onBlur={e => {
                        setTouched(true);
                        if (contact && value) {
                            const next = normalizeField(field, value).value;
                            if (next !== value) onChange(next);
                        }
                        onBlur?.(e);
                    }}
                    {...rest}
                />
                {broken && (
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-danger" title={broken.detail ?? "Link not found"}>
                        <CircleAlert className="size-4" aria-hidden />
                        <span className="sr-only">Link not found</span>
                    </span>
                )}
            </div>
        </Field>
    );
}
