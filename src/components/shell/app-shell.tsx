"use client";

import React, { Suspense, useState } from "react";
import { ShellContext } from "./shell-context";
import { SidebarNav, type ShellUser } from "./sidebar-nav";
import { Drawer } from "@/components/ui/primitives/drawer";

/** Dashboard chrome: fixed 240px sidebar on large screens, a drawer below. */
export function AppShell({ user, signOutAction, children }: { user: ShellUser; signOutAction: () => Promise<void>; children: React.ReactNode }) {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const api = { openDrawer: () => setDrawerOpen(true), closeDrawer: () => setDrawerOpen(false) };

    return (
        <ShellContext.Provider value={api}>
            <div className="min-h-dvh bg-bg text-fg lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
                <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-r lg:border-border lg:bg-surface">
                    <Suspense fallback={null}>
                        <SidebarNav user={user} signOutAction={signOutAction} />
                    </Suspense>
                </aside>
                <Drawer open={drawerOpen} onClose={api.closeDrawer} label="Navigation">
                    <Suspense fallback={null}>
                        <SidebarNav user={user} signOutAction={signOutAction} onNavigate={api.closeDrawer} />
                    </Suspense>
                </Drawer>
                <div className="flex min-w-0 flex-col">{children}</div>
            </div>
        </ShellContext.Provider>
    );
}
