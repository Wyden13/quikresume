// src/components/site-footer.tsx
import Link from "next/link";
import Image from "next/image";

export function SiteFooter() {
    return (
        <footer className="w-full max-w-[1280px] mx-auto border-t border-black/10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center px-6 py-12 md:px-16 md:py-16 gap-10">
                <Link href="/" className="flex flex-row items-center gap-2">
                    <Image src="/icons/quik-resume.svg" alt="quikResume Logo" width={32} height={32} className="w-8 h-8" />
                    <span className="font-semibold text-[18px] md:text-[20px] tracking-tight">quikResume</span>
                </Link>
                <nav className="flex flex-col md:flex-row items-start gap-4 md:gap-8">
                    <Link href="/dashboard" className="font-medium text-[16px] text-black/55 hover:text-black transition-colors">Dashboard</Link>
                    <Link href="/dashboard/profile" className="font-medium text-[16px] text-black/55 hover:text-black transition-colors">Profile</Link>
                </nav>
            </div>
            <div className="pb-8 text-center text-[12px] text-black/20 font-bold uppercase tracking-widest">
                &copy; {new Date().getFullYear()} quikResume. All rights reserved.
            </div>
        </footer>
    );
}
