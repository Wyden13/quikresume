"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { parseView, viewHref, type View } from "@/lib/ui/use-dashboard-view";
import { useMediaQuery, XL } from "@/lib/ui/use-media-query";
import { togglePreviewPane, usePreviewPane } from "@/lib/ui/preview-pane-store";
import { interceptNavigation } from "@/lib/ui/leave-guard";
import { FOCUS_RING } from "@/components/ui/primitives/button";
import { BarChart3, Compass, Eye, Layers, Library, LogOut, PenLine, Target, Upload, User, type LucideIcon } from "@/components/ui/primitives/icons";

export interface ShellUser { name: string; email: string; image: string | null }

interface NavItem { label: string; icon: LucideIcon; href: string; view?: View; match: (pathname: string, view: View) => boolean }

const PRIMARY: NavItem[] = [
    { label: "Library", icon: Library, href: viewHref("library"), view: "library", match: (p, v) => p === "/dashboard" && v === "library" },
    { label: "Editor", icon: PenLine, href: viewHref("editor"), view: "editor", match: (p, v) => p === "/dashboard" && v === "editor" },
    { label: "Preview", icon: Eye, href: viewHref("preview"), view: "preview", match: (p, v) => p === "/dashboard" && v === "preview" },
    { label: "Import", icon: Upload, href: viewHref("import"), view: "import", match: (p, v) => p === "/dashboard" && v === "import" },
    { label: "Insights", icon: BarChart3, href: viewHref("insights"), view: "insights", match: (p, v) => p === "/dashboard" && v === "insights" },
    { label: "Job Match", icon: Target, href: viewHref("jobs"), view: "jobs", match: (p, v) => p === "/dashboard" && v === "jobs" },
];
const SECONDARY: NavItem[] = [
    { label: "Variants", icon: Layers, href: "/dashboard/variants", match: p => p.startsWith("/dashboard/variants") },
    { label: "About you", icon: Compass, href: "/dashboard/about", match: p => p.startsWith("/dashboard/about") },
    { label: "Profile", icon: User, href: "/dashboard/profile", match: p => p.startsWith("/dashboard/profile") },
];

const ITEM = "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors";
const IDLE = "text-fg-muted hover:bg-surface-hover hover:text-fg";
const ACTIVE = "bg-surface-muted font-medium text-fg";

export function SidebarNav({ user, signOutAction, onNavigate }: { user: ShellUser; signOutAction: () => Promise<void>; onNavigate?: () => void }) {
    const pathname = usePathname();
    const params = useSearchParams();
    const view = pathname === "/dashboard" ? parseView(params.get("view")) : "library";
    const wide = useMediaQuery(XL);
    const paneOpen = usePreviewPane();

    const follow = (href: string) => (e: React.MouseEvent) => {
        if (interceptNavigation(href)) e.preventDefault();
        onNavigate?.();
    };

    const render = (item: NavItem) => {
        const Icon = item.icon;
        // On wide screens "Preview" toggles the side pane instead of navigating.
        if (item.view === "preview" && wide) {
            return (
                <li key={item.label}>
                    <button type="button" onClick={() => { togglePreviewPane(); onNavigate?.(); }} aria-pressed={paneOpen} className={cn(ITEM, "w-full", paneOpen ? ACTIVE : IDLE, FOCUS_RING)}>
                        <Icon className="size-4 shrink-0" aria-hidden />
                        <span className="flex-1 text-left">Preview</span>
                        <span className="text-xs text-fg-subtle">{paneOpen ? "On" : "Off"}</span>
                    </button>
                </li>
            );
        }
        const active = item.match(pathname, view);
        return (
            <li key={item.label}>
                <Link href={item.href} onClick={follow(item.href)} aria-current={active ? "page" : undefined} className={cn(ITEM, active ? ACTIVE : IDLE, FOCUS_RING)}>
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {item.label}
                </Link>
            </li>
        );
    };

    return (
        <div className="flex h-full flex-col">
            <div className="flex h-14 items-center px-4">
                <Link href="/dashboard" onClick={follow("/dashboard")} className={cn("flex items-center gap-2 rounded-md", FOCUS_RING)}>
                    <Image src="/icons/quik-resume.svg" alt="" width={24} height={24} className="size-6" priority />
                    <span className="text-[15px] font-semibold tracking-tight">quikResume</span>
                </Link>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="Main">
                <ul className="space-y-0.5">{PRIMARY.map(render)}</ul>
                <div className="my-3 border-t border-border" />
                <ul className="space-y-0.5">{SECONDARY.map(render)}</ul>
            </nav>
            <div className="flex items-center gap-2.5 border-t border-border px-4 py-3">
                {user.image ? (
                    <Image src={user.image} alt="" width={28} height={28} className="size-7 shrink-0 rounded-full" />
                ) : (
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-medium text-fg-muted">{(user.name || user.email || "?").slice(0, 1).toUpperCase()}</span>
                )}
                <div className="min-w-0 flex-1 leading-tight">
                    {user.name && <p className="truncate text-13 font-medium text-fg">{user.name}</p>}
                    <p className="truncate text-xs text-fg-subtle">{user.email}</p>
                </div>
                <form action={signOutAction}>
                    <button type="submit" title="Sign out" aria-label="Sign out" className={cn("flex size-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg", FOCUS_RING)}>
                        <LogOut className="size-4" aria-hidden />
                    </button>
                </form>
            </div>
        </div>
    );
}
