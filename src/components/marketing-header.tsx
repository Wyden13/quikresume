// Header for the public pages (landing, login). The signed-in app uses the sidebar shell.
import Link from "next/link";
import Image from "next/image";
import type { Session } from "next-auth";

const BTN = "inline-flex h-9 items-center justify-center rounded-md px-3.5 text-sm font-medium transition-colors";

export function MarketingHeader({ session, backHome = false }: { session: Session | null; backHome?: boolean }) {
    return (
        <header className="border-b border-border bg-surface">
            <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
                <Link href="/" className="flex items-center gap-2">
                    <Image src="/icons/quik-resume.svg" alt="" width={24} height={24} className="size-6" priority />
                    <span className="text-[15px] font-semibold tracking-tight">quikResume</span>
                </Link>
                <nav className="flex items-center gap-2">
                    {session ? (
                        <Link href="/dashboard" className={`${BTN} bg-accent text-accent-fg hover:bg-accent-hover`}>Dashboard</Link>
                    ) : backHome ? (
                        <Link href="/" className={`${BTN} text-fg-muted hover:bg-surface-hover hover:text-fg`}>Back to home</Link>
                    ) : (
                        <>
                            <Link href="/login" className={`${BTN} hidden text-fg-muted hover:bg-surface-hover hover:text-fg sm:inline-flex`}>Log in</Link>
                            <Link href="/login" className={`${BTN} bg-accent text-accent-fg hover:bg-accent-hover`}>Get started</Link>
                        </>
                    )}
                </nav>
            </div>
        </header>
    );
}

export function MarketingFooter() {
    return (
        <footer className="border-t border-border">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-8 text-13 text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
                <span>&copy; {new Date().getFullYear()} quikResume</span>
                <nav className="flex gap-5">
                    <Link href="#features" className="hover:text-fg">Features</Link>
                    <Link href="/login" className="hover:text-fg">Log in</Link>
                </nav>
            </div>
        </footer>
    );
}
