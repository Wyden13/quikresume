"use client";

// Fire-and-forget link verification after a save (/api/profile/check-links). Never awaited by a save;
// the route stores the result on the user document and `onChanged` refreshes the page to show marks.

import { readJson } from "./fetch-json";

let inFlight = false;

export function kickLinkCheck(onChanged: () => void): void {
    if (inFlight) return;
    inFlight = true;
    void fetch("/api/profile/check-links", { method: "POST" })
        .then(res => readJson<{ changed: boolean }>(res))
        .then(r => { if (r.ok && r.changed) onChanged(); })
        .catch(() => { /* a failed check leaves the old marks; nothing to tell the user */ })
        .finally(() => { inFlight = false; });
}
