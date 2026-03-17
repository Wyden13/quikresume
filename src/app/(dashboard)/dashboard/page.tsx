// src/app/(dashboard)/dashboard/page.tsx
import { auth, signIn, signOut } from "@/auth"
import { getExperiences } from "@/app/actions/experience-actions"
import { getEducations } from "@/app/actions/education-actions"
import { getSkills } from "@/app/actions/skill-actions"
import DashboardClient from "@/components/dashboard-client"
import Link from "next/link"
import Image from "next/image"
import { redirect } from "next/navigation";

export default async function DashboardPage() {
    const session = await auth();

    if (!session?.user?.id) {
        redirect("/login");
    }

    const experiences = await getExperiences();
    const educations = await getEducations();
    const skills = await getSkills();

    return (
        <div className="min-h-screen flex flex-col bg-white text-black font-sans">
            {/* Header */}
            <header className="flex flex-row justify-between items-center px-6 py-6 md:px-16 md:py-6 w-full max-w-[1280px] mx-auto border-b border-black/5">
                <Link href="/" className="flex flex-row items-center gap-2">
                    {/* Updated Logo Icon */}
                    <Image
                        src="/icons/quik-resume.svg"
                        alt="quikResume Logo"
                        width={40}
                        height={40}
                        className="w-7 h-7 md:w-10 md:h-10"
                        priority
                    />
                    <span className="font-semibold text-lg md:text-2xl tracking-tight">quikResume</span>
                </Link>
                <div className="flex flex-row items-center gap-4 md:gap-6">
                    <div className="hidden md:flex flex-row items-center gap-3 pr-6 border-r border-black/10">
                        {session?.user?.image && (
                            <Image
                                src={session.user.image}
                                alt="Profile"
                                width={32}
                                height={32}
                                className="rounded-full"
                            />
                        )}
                        <span className="font-medium text-sm text-black/60">{session?.user?.email}</span>
                    </div>
                    <form action={async () => {
                        "use server";
                        await signOut({ redirectTo: "/" })
                    }}>
                        <button className="flex justify-center items-center px-4 py-2.5 bg-black text-white rounded-xl font-bold text-sm hover:bg-black/80 transition-all active:scale-95">
                            Sign Out
                        </button>
                    </form>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-grow">
                <DashboardClient
                    initialExperiences={experiences}
                    initialEducations={educations}
                    initialSkills={skills}
                    userName={session?.user?.name?.split(" ")[0] || "User"}
                />
            </main>

            {/* Footer */}
            <footer className="w-full max-w-[1280px] mx-auto border-t border-black/10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center px-6 py-12 md:px-16 md:py-16 gap-14">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-8">
                        <Link href="/" className="flex flex-row items-center gap-2">
                            {/* Updated Footer Logo Icon */}
                            <Image
                                src="/icons/quik-resume.svg"
                                alt="quikResume Logo"
                                width={32}
                                height={32}
                                className="w-8 h-8"
                            />
                            <span className="font-semibold text-[18px] md:text-[20px] tracking-tight">quikResume</span>
                        </Link>

                        <nav className="flex flex-col md:flex-row items-start gap-4 md:gap-8">
                            <Link href="#" className="font-medium text-[16px] text-black/55 hover:text-black transition-colors">Features</Link>
                            <Link href="#" className="font-medium text-[16px] text-black/55 hover:text-black transition-colors">Learn more</Link>
                            <Link href="#" className="font-medium text-[16px] text-black/55 hover:text-black transition-colors">Support</Link>
                        </nav>
                    </div>

                    <div className="flex flex-row items-center gap-4 md:gap-6">
                        <div className="w-6 h-6 bg-black/45 rounded-sm"></div>
                        <div className="w-6 h-6 bg-black/45 rounded-sm"></div>
                        <div className="w-6 h-6 bg-black/45 rounded-sm"></div>
                    </div>
                </div>
                <div className="pb-8 text-center text-[12px] text-black/20 font-bold uppercase tracking-widest">
                    &copy; {new Date().getFullYear()} quikResume. All rights reserved.
                </div>
            </footer>
        </div>
    )
}