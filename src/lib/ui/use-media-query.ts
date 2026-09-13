"use client";

import { useSyncExternalStore } from "react";

/** Hydration-safe media query: false on the server and during hydration, then live. */
export function useMediaQuery(query: string): boolean {
    return useSyncExternalStore(
        (onChange) => {
            const mql = window.matchMedia(query);
            mql.addEventListener("change", onChange);
            return () => mql.removeEventListener("change", onChange);
        },
        () => window.matchMedia(query).matches,
        () => false,
    );
}

export const XL = "(min-width: 1280px)";
export const LG = "(min-width: 1024px)";
