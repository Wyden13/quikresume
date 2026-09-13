// src/components/site-header.tsx
// Signed-in header shared by the dashboard and profile pages (server component).
import Link from "next/link";
import Image from "next/image";
import type { Session } from "next-auth";
import { signOut } from "@/auth";
import { NavLink } from "@/components/nav-link";

export function SiteHeader({ session }: { session: Session }) {
    return (
        <header className="flex flex-row justify-between items-center gap-4 px-6 py-6 md:px-16 w-full max-w-[1280px] mx-auto border-b border-black/5">
            <div className="flex flex-row items-center gap-6">
                <Link href="/" className="flex flex-row items-center gap-2">
                    <Image src="/icons/quik-resume.svg" alt="quikResume Logo" width={40} height={40} className="w-7 h-7 md:w-10 md:h-10" priority />
                    <span className="font-semibold text-lg md:text-2xl tracking-tight">quikResume</span>
                </Link>
                <nav className="hidden sm:flex items-center gap-1">
                    <NavLink href="/dashboard">Dashboard</NavLink>
                    <NavLink href="/dashboard/variants">Variants</NavLink>
                    <NavLink href="/dashboard/profile">Profile</NavLink>
                </nav>
            </div>
            <div className="flex flex-row items-center gap-4 md:gap-6">
                <Link href="/dashboard/profile" className="flex flex-row items-center gap-3 md:pr-6 md:border-r border-black/10" title="Your profile">
                    {session.user?.image && (
                        <Image src={session.user.image} alt="Profile" width={32} height={32} className="rounded-full" />
                    )}
                    <span className="hidden md:inline font-medium text-sm text-black/60">{session.user?.email}</span>
                </Link>
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
    );
}
