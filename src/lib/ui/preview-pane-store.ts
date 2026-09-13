"use client";

import { createPersistedStore } from "./persisted-store";

/** Whether the right-hand preview pane is open (desktop only). */
export const previewPaneStore = createPersistedStore<boolean>({ key: "quikresume.previewPane", storage: "local", initial: false });

export const usePreviewPane = () => previewPaneStore.use();
export const setPreviewPane = (open: boolean) => previewPaneStore.set(open);
export const togglePreviewPane = () => previewPaneStore.set(v => !v);
