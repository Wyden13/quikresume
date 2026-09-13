// src/components/ui/profile-form.tsx
"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { PersonalInfo } from "@/types/schema";
import { updateUserProfile } from "@/app/actions/user-actions";
import { Button, Input, Label, Textarea } from "@/components/ui/form-controls";

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

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8 items-start">
            {/* Account card */}
            <aside className="bg-gray-50/60 border-2 border-black/5 rounded-[2rem] p-8 space-y-6">
                <div className="flex items-center gap-4">
                    {account.image ? (
                        <Image src={account.image} alt="" width={56} height={56} className="rounded-full border-2 border-white shadow" />
                    ) : (
                        <div className="w-14 h-14 rounded-full bg-black/10" />
                    )}
                    <div className="min-w-0">
                        <p className="font-black text-lg leading-tight truncate">{account.name || "Google account"}</p>
                        <p className="text-sm text-black/50 font-medium truncate">{account.email}</p>
                    </div>
                </div>
                <p className="text-xs text-black/40 font-bold uppercase tracking-widest">Signed in with Google</p>
                <p className="text-sm text-black/55 leading-relaxed">
                    Your sign-in email stays private. The professional email below is the one printed on your resume.
                </p>
                <Link href="/dashboard" className="inline-flex text-sm font-bold underline underline-offset-4">Back to dashboard</Link>
            </aside>

            {/* Form */}
            <section className="bg-white border-2 border-black/5 rounded-[2rem] p-6 md:p-8 space-y-8 shadow-2xl shadow-black/5">
                {error && (
                    <div role="alert" className="border-2 border-red-200 bg-red-50 rounded-2xl p-5 text-red-800 text-sm font-bold">{error}</div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <Label htmlFor="firstName">First Name</Label>
                        <Input id="firstName" value={info.firstName} onChange={set("firstName")} placeholder="Alex" autoComplete="given-name" />
                    </div>
                    <div>
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input id="lastName" value={info.lastName} onChange={set("lastName")} placeholder="Morgan" autoComplete="family-name" />
                    </div>
                    <div className="col-span-full">
                        <Label htmlFor="headline">Headline</Label>
                        <Input id="headline" value={info.headline} onChange={set("headline")} placeholder="B.S. Computer Science, Class of 2026 · Software · AI/ML" />
                    </div>
                    <div>
                        <Label htmlFor="email">Professional Email</Label>
                        <Input id="email" type="email" value={info.email} onChange={set("email")} placeholder="alex@example.com" autoComplete="email" />
                    </div>
                    <div>
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input id="phone" type="tel" value={info.phone} onChange={set("phone")} placeholder="(123) 456-7890" autoComplete="tel" />
                    </div>
                    <div className="col-span-full">
                        <Label htmlFor="location">Location</Label>
                        <Input id="location" value={info.location} onChange={set("location")} placeholder="Seattle, WA" />
                    </div>
                    <div>
                        <Label htmlFor="github">GitHub</Label>
                        <Input id="github" value={info.github} onChange={set("github")} placeholder="github.com/alexmorgan" />
                    </div>
                    <div>
                        <Label htmlFor="linkedin">LinkedIn</Label>
                        <Input id="linkedin" value={info.linkedin} onChange={set("linkedin")} placeholder="linkedin.com/in/alexmorgan" />
                    </div>
                    <div className="col-span-full">
                        <Label htmlFor="website">Website</Label>
                        <Input id="website" value={info.website} onChange={set("website")} placeholder="alexmorgan.dev" />
                    </div>
                    <div className="col-span-full">
                        <Label htmlFor="summary">Professional Summary</Label>
                        <Textarea id="summary" value={info.summary} onChange={set("summary")} placeholder="Brief overview of your professional background and goals..." rows={5} />
                    </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-4 pt-6 border-t border-black/5">
                    <span className="text-xs font-black uppercase tracking-widest text-black/40" aria-live="polite">
                        {status === "saved" ? "Saved" : dirty ? "Unsaved changes" : ""}
                    </span>
                    <Button variant="primary" size="lg" onClick={handleSave} loading={status === "saving"} disabled={!dirty && status !== "error"}>
                        Save Profile
                    </Button>
                </div>
            </section>
        </div>
    );
}
