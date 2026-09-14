import React from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { MarketingFooter, MarketingHeader } from "@/components/marketing-header";
import { MarketingHeroMock } from "@/components/marketing-hero-mock";

const PRIMARY = "inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover";
const SECONDARY = "inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-hover";

const FEATURES = [
    { title: "One library, many résumés", body: "Keep every role, project and skill in one place. Toggle what each application should show; nothing is retyped." },
    { title: "Real PDF, compiled in your browser", body: "Typst renders a crisp, ATS-readable PDF on the fly. Live preview as you edit, one page or two, your call." },
    { title: "Job Match", body: "Paste a job description. See which must-haves you cover, which keywords are missing, and get concrete rewrite suggestions." },
    { title: "Import in seconds", body: "Drop in an old PDF or Word résumé and it is read straight into your library, duplicates merged." },
];

export default async function Home() {
    const session = await auth();
    const cta = session ? "/dashboard" : "/login";

    return (
        <div className="min-h-dvh bg-bg text-fg">
            <MarketingHeader session={session} />

            <section className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28">
                <div className="max-w-2xl">
                    <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight md:text-5xl">
                        A résumé for every application, from one library.
                    </h1>
                    <p className="mt-5 max-w-xl text-base text-fg-muted md:text-lg">
                        Keep your whole professional history in one place, switch items on and off per job, and download a real PDF in a click.
                    </p>
                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <Link href={cta} className={PRIMARY}>{session ? "Go to dashboard" : "Get started"}</Link>
                        {!session && <Link href="/login" className={SECONDARY}>Log in</Link>}
                    </div>
                </div>
                <MarketingHeroMock />
            </section>

            <section id="features" className="border-t border-border bg-surface">
                <div className="mx-auto grid w-full max-w-6xl gap-x-12 gap-y-10 px-6 py-16 md:grid-cols-2 md:py-20">
                    {FEATURES.map(f => (
                        <div key={f.title} className="border-t border-border pt-5">
                            <h2 className="text-lg font-semibold tracking-tight">{f.title}</h2>
                            <p className="mt-2 text-sm text-fg-muted md:text-base">{f.body}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="mx-auto flex w-full max-w-6xl flex-col items-start gap-5 px-6 py-16 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight">Ready when you are.</h2>
                    <p className="mt-1 text-fg-muted">Sign in with Google. Nothing to install.</p>
                </div>
                <Link href={cta} className={PRIMARY}>{session ? "Open dashboard" : "Create your library"}</Link>
            </section>

            <MarketingFooter />
        </div>
    );
}
