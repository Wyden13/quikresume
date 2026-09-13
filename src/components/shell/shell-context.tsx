"use client";

import { createContext, useContext } from "react";

export interface ShellApi {
    openDrawer: () => void;
    closeDrawer: () => void;
}

export const ShellContext = createContext<ShellApi | null>(null);

/** Null outside the dashboard shell (landing / login render no drawer). */
export const useShell = () => useContext(ShellContext);
