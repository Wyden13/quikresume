"use client";

import React, { useRef } from "react";
import Link from "next/link";
import type { PersonalInfo } from "@/types/schema";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives/card";
import { Field, Input, Textarea } from "@/components/ui/primitives/field";
import { summaryWordCount, wordCaution } from "@/lib/text/word-count";

export function PersonalInfoSection({ value, onChange }: { value: PersonalInfo; onChange: (field: keyof PersonalInfo, v: string) => void }) {
    const f = (field: keyof PersonalInfo, label: string, placeholder: string, extra?: React.ComponentProps<typeof Input>) => (
        <Field label={label} htmlFor={`pi-${field}`}>
            <Input id={`pi-${field}`} value={value[field]} onChange={e => onChange(field, e.target.value)} placeholder={placeholder} {...extra} />
        </Field>
    );
    return (
        <Card>
            <CardHeader
                title="Personal information"
                hint={<>Also editable on your <Link href="/dashboard/profile" className="text-fg underline underline-offset-2">Profile</Link> page.</>}
            />
            <CardBody className="grid gap-4 md:grid-cols-2">
                {f("firstName", "First name", "Alex")}
                {f("lastName", "Last name", "Morgan")}
                <div className="md:col-span-2">{f("headline", "Headline", "B.S. Computer Science, Class of 2026 · Software · AI/ML")}</div>
                {f("email", "Professional email", "alex@example.com", { type: "email" })}
                {f("phone", "Phone", "(123) 456-7890")}
                {f("location", "Location", "Seattle, WA")}
                {f("website", "Website", "alexmorgan.dev")}
                {f("github", "GitHub", "github.com/alexmorgan")}
                {f("linkedin", "LinkedIn", "linkedin.com/in/alexmorgan")}
            </CardBody>
        </Card>
    );
}

/** The professional summary: its own (movable) résumé section in the editor. */
export function SummaryField({ value, onChange, autoFocus }: { value: PersonalInfo; onChange: (field: keyof PersonalInfo, v: string) => void; autoFocus?: boolean }) {
    // Ref callback (not an effect): an Action items link scrolls here exactly once.
    const focused = useRef(false);
    const focusRef = (node: HTMLTextAreaElement | null) => {
        if (!node || !autoFocus || focused.current) return;
        focused.current = true;
        node.scrollIntoView({ block: "center", behavior: "smooth" });
        node.focus({ preventScroll: true });
    };
    return (
        <Card>
            <CardBody className="pt-4">
                <Field label="Professional summary" htmlFor="pi-summary" {...wordCaution(summaryWordCount(value), "your summary")}>
                    <Textarea ref={focusRef} id="pi-summary" value={value.summary} onChange={e => onChange("summary", e.target.value)} placeholder="Brief overview of your professional background and goals…" rows={4} />
                </Field>
            </CardBody>
        </Card>
    );
}
