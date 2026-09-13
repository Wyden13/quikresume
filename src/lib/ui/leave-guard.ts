"use client";

// One in-app navigation guard at a time (the Master Editor with unsaved changes).
// Links outside the dashboard client (the sidebar) ask it before navigating; the
// guard returns true when it took over (e.g. opened a "Leave the editor?" dialog).

type Guard = (href: string) => boolean;

let guard: Guard | null = null;

/** Installs `g`; returns the uninstaller. */
export function setLeaveGuard(g: Guard): () => void {
    guard = g;
    return () => {
        if (guard === g) guard = null;
    };
}

/** True when a guard intercepted the navigation to `href` (the caller must not navigate). */
export function interceptNavigation(href: string): boolean {
    return guard ? guard(href) : false;
}
