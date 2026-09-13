"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Header nav link that highlights when the current route matches exactly. */
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
    const active = usePathname() === href;
    return (
        <Link
            href={href}
            aria-current={active ? "page" : undefined}
            className={`px-3 py-2 rounded-xl text-sm font-bold transition-colors ${
                active ? "bg-black text-white" : "text-black/55 hover:text-black hover:bg-black/5"
            }`}
        >
            {children}
        </Link>
    );
}
