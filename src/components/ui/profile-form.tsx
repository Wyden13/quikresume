// src/components/ui/profile-form.tsx
"use client";

import React, { useState } from "react";
import Image from "next/image";
import type { PersonalInfo } from "@/types/schema";
import { updateUserProfile } from "@/app/actions/user-actions";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/primitives/button";
import { Field, Input, Textarea } from "@/components/ui/primitives/field";
import { summaryWordCount, wordCaution } from "@/lib/text/word-count";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives/card";
import { NoticeBanner } from "@/components/ui/primitives/notice-banner";

interface ProfileFormProps {
    initial: PersonalInfo;
    account: { name: string; email: string; image: string | null };
}

type Status = "idle" | "saving" | "saved" | "error";

export function ProfileForm({ initial, account }: ProfileFormProps) {
    // Local draft seeded once from the server value; never re-synced from props.
    const [info, setInfo] = useState<PersonalInfo>(initial);
    const [status, setStatus] = useState<Status>("idle");
    const [error, setError] = useState<string | null>(null);

    const set = (field: keyof PersonalInfo) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setInfo(prev => ({ ...prev, [field]: e.target.value }));
        if (status === "saved") setStatus("idle");
    };

    const handleSave = async () => {
        setStatus("saving");
        setError(null);
        try {
            await updateUserProfile(info);
            setStatus("saved");
        } catch (err) {
            setStatus("error");
            setError(err instanceof Error ? err.message : "Failed to save your profile.");
        }
    };

    const dirty = JSON.stringify(info) !== JSON.stringify(initial);

    const f = (field: keyof PersonalInfo, label: string, placeholder: string, extra?: React.ComponentProps<typeof Input>, className?: string) => (
        <Field label={label} htmlFor={`profile-${field}`} className={className}>
            <Input id={`profile-${field}`} value={info[field]} onChange={set(field)} placeholder={placeholder} {...extra} />
        </Field>
    );

    return (
        <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <Card as="aside">
                <CardBody className="space-y-4 pt-4">
                    <div className="flex items-center gap-3">
                        {account.image ? (
                            <Image src={account.image} alt="" width={40} height={40} className="size-10 rounded-full" />
                        ) : (
                            <div className="size-10 rounded-full bg-surface-muted" />
                        )}
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-fg">{account.name || "Google account"}</p>
                            <p className="truncate text-13 text-fg-muted">{account.email}</p>
                        </div>
                    </div>
                    <p className="text-13 text-fg-muted">
                        Signed in with Google. Your sign-in email stays private; the professional email on the right is the one printed on your résumé.
                    </p>
                </CardBody>
            </Card>

            <Card>
                <CardHeader title="Résumé header" hint="These fields appear at the top of every résumé you generate." />
                <CardBody className="space-y-4">
                    {error && <NoticeBanner tone="danger" onDismiss={() => setError(null)}>{error}</NoticeBanner>}
                    <div className="grid gap-4 md:grid-cols-2">
                        {f("firstName", "First name", "Alex", { autoComplete: "given-name" })}
                        {f("lastName", "Last name", "Morgan", { autoComplete: "family-name" })}
                        {f("headline", "Headline", "B.S. Computer Science, Class of 2026 · Software · AI/ML", undefined, "md:col-span-2")}
                        {f("email", "Professional email", "alex@example.com", { type: "email", autoComplete: "email" })}
                        {f("phone", "Phone", "(123) 456-7890", { type: "tel", autoComplete: "tel" })}
                        {f("location", "Location", "Seattle, WA")}
                        {f("website", "Website", "alexmorgan.dev")}
                        {f("github", "GitHub", "github.com/alexmorgan")}
                        {f("linkedin", "LinkedIn", "linkedin.com/in/alexmorgan")}
                        <Field label="Professional summary" htmlFor="profile-summary" className="md:col-span-2" {...wordCaution(summaryWordCount(info), "your summary")}>
                            <Textarea id="profile-summary" value={info.summary} onChange={set("summary")} placeholder="Brief overview of your professional background and goals…" rows={4} />
                        </Field>
                    </div>
                    <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-end">
                        <span className={cn("text-13", status === "saved" ? "text-success" : "text-fg-subtle")} aria-live="polite">
                            {status === "saved" ? "Saved" : dirty ? "Unsaved changes" : ""}
                        </span>
                        <Button variant="primary" onClick={handleSave} loading={status === "saving"} disabled={!dirty && status !== "error"}>
                            Save profile
                        </Button>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
