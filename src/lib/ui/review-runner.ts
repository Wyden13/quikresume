"use client";

// Client side of the background coach review (/api/review/run). One request at a time per tab; ids asked
// for while a run is in flight are queued for the next one. Automatic runs are fire-and-forget and never
// awaited by a save. Guards against loops: an automatic run for a set of stale items is attempted once
// per session, and a server without GLM switches automatic runs off.

import { useSyncExternalStore } from "react";
import { readJson } from "./fetch-json";

export interface ReviewRunState {
    running: boolean;
    /** Ids explicitly re-reviewed (spinners on those rows); empty during stale-only runs. */
    ids: readonly string[];
    error: string | null;
}

type Scope = "stale" | "outdated-brief";
export interface RunResult { reviewed: number; remaining: number }

let state: ReviewRunState = { running: false, ids: [], error: null };
const listeners = new Set<() => void>();
const emit = (next: Partial<ReviewRunState>) => { state = { ...state, ...next }; listeners.forEach(l => l()); };

let disabled = false;
const attempted = new Set<string>();
let queuedIds = new Set<string>();
let queuedStale = false;
let onDoneQueue: ((r: RunResult) => void)[] = [];

const SERVER: ReviewRunState = { running: false, ids: [], error: null };
export function useReviewRunState(): ReviewRunState {
    return useSyncExternalStore(cb => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => state, () => SERVER);
}

async function post(body: { ids?: string[]; scope?: Scope }, retried = false): Promise<RunResult | null> {
    const res = await fetch("/api/review/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const reply = await readJson<{ reviewed: number; remaining: number; busy: boolean; disabled: boolean }>(res);
    if (reply.ok) return { reviewed: reply.reviewed ?? 0, remaining: reply.remaining ?? 0 };
    if (reply.busy && !retried) {
        // Another tab is reviewing: try once more after it has had time to finish.
        await new Promise(r => setTimeout(r, 60_000));
        return post(body, true);
    }
    if (reply.disabled) disabled = true;
    throw new Error(reply.error ?? "The review could not run.");
}

async function drain(first: { ids?: string[]; scope?: Scope }) {
    let body: { ids?: string[]; scope?: Scope } | null = first;
    while (body) {
        emit({ running: true, ids: body.ids ?? [], error: null });
        const callbacks = onDoneQueue;
        onDoneQueue = [];
        try {
            const result = await post(body);
            if (result) callbacks.forEach(cb => cb(result));
        } catch (err) {
            emit({ error: err instanceof Error ? err.message : "The review could not run." });
            callbacks.forEach(cb => cb({ reviewed: 0, remaining: 0 }));
        }
        if (queuedIds.size > 0) { body = { ids: [...queuedIds] }; queuedIds = new Set(); }
        else if (queuedStale) { body = {}; }
        else body = null;
        queuedStale = false;
    }
    emit({ running: false, ids: [] });
}

/**
 * Starts a review run. `ids` re-reviews those items (explicit); otherwise items whose text changed.
 * `signature` (sorted stale ids) makes an automatic run happen once per set of changes.
 */
export function kickReviews(opts: { ids?: string[]; scope?: Scope; signature?: string; onDone?: (r: RunResult) => void } = {}): void {
    const explicit = Boolean(opts.ids?.length) || opts.scope === "outdated-brief";
    if (!explicit) {
        if (disabled) return;
        if (opts.signature !== undefined) {
            if (attempted.has(opts.signature)) return;
            attempted.add(opts.signature);
        }
    }
    if (opts.onDone) onDoneQueue.push(opts.onDone);
    if (state.running) {
        if (opts.ids?.length) opts.ids.forEach(id => queuedIds.add(id));
        else queuedStale = true;
        return;
    }
    void drain({ ids: opts.ids, scope: opts.scope });
}

/** Runs "outdated-brief" reviews until nothing is left (or a pass makes no progress). */
export function reReviewAll(onProgress: (r: RunResult) => void, onFinished: () => void): void {
    const step = () => kickReviews({
        scope: "outdated-brief",
        onDone: r => {
            onProgress(r);
            if (r.remaining > 0 && r.reviewed > 0) step();
            else onFinished();
        },
    });
    step();
}
