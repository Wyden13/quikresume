// src/app/(dashboard)/dashboard/about/page.tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { loadResumeData } from "@/lib/db/load-resume";
import { readCharacterizationDoc } from "@/lib/db/characterization";
import { educationStatusOf, employmentGaps, yearsOfExperience } from "@/lib/about/facts";
import { libraryIsEmpty } from "@/lib/about/library-summary";
import { AboutForm } from "@/components/ui/about/about-form";
import { TopBar } from "@/components/ui/primitives/top-bar";

export const maxDuration = 60;

export default async function AboutPage({ searchParams }: { searchParams: Promise<{ first?: string }> }) {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    const [sp, data, saved] = await Promise.all([searchParams, loadResumeData(session.user.id, session.user.name), readCharacterizationDoc(session.user.id)]);
    const edu = educationStatusOf(data);

    return (
        <>
            <TopBar title="About you" subtitle="Your goals and background, so AI reviews and tailoring fit where you are in your career." />
            <main className="p-4 pb-16 md:p-6">
                <div className="mx-auto max-w-3xl">
                    <AboutForm
                        saved={saved}
                        computed={{ yearsExperience: yearsOfExperience(data), educationStatus: edu.status, graduation: edu.graduation }}
                        gaps={employmentGaps(data)}
                        emptyLibrary={libraryIsEmpty(data)}
                        firstRun={sp.first === "1"}
                    />
                </div>
            </main>
        </>
    );
}
