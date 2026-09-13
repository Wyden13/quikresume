// src/components/ui/variants-page.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { ResumeData } from "@/types/schema";
import type { ResumeVariant } from "@/types/db";
import { createVariant, deleteVariant, duplicateVariant, loadVariant, resnapshotVariant, updateVariant } from "@/app/actions/variant-actions";
import { countItems, missingCount, selectedIds, selectionEquals } from "@/lib/variants";
import { COLLECTION_SECTION, SECTION_LABEL, COLLECTION_NAMES } from "@/lib/sections";
import { Button, Input, Label } from "@/components/ui/form-controls";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface VariantsPageProps {
    variants: ResumeVariant[];
    loadedVariantId: string | null;
    data: ResumeData;
}

const parseLabels = (s: string) => s.split(",").map(x => x.trim()).filter(Boolean);
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "");

export function VariantsPage({ variants, loadedVariantId, data }: VariantsPageProps) {
    const [query, setQuery] = useState("");
    const [labelFilter, setLabelFilter] = useState<string | null>(null);
    const [newName, setNewName] = useState("");
    const [newLabels, setNewLabels] = useState("");
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [pendingDelete, setPendingDelete] = useState<ResumeVariant | null>(null);

    const allLabels = [...new Set(variants.flatMap(v => v.labels))].sort();
    const q = query.trim().toLowerCase();
    const shown = variants.filter(v =>
        (!q || v.name.toLowerCase().includes(q) || v.labels.some(l => l.toLowerCase().includes(q))) &&
        (!labelFilter || v.labels.includes(labelFilter)),
    );
    const selectedNow = countItems(selectedIds(data));

    const run = async (key: string, fn: () => Promise<void>, done?: string) => {
        setBusy(key);
        setError(null);
        setNotice(null);
        try {
            await fn();
            if (done) setNotice(done);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong.");
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="max-w-[1280px] mx-auto p-6 md:p-12 space-y-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-black/5 pb-10">
                <div className="space-y-2">
                    <h1 className="text-4xl font-black tracking-tight text-gray-900 leading-none">Resume variants</h1>
                    <p className="text-lg text-black/40 font-bold">Saved selections of your library, one per kind of application. Nothing is duplicated: a variant only remembers which items were included.</p>
                </div>
                <Link href="/dashboard" className="px-6 py-4 rounded-[2rem] font-black text-sm uppercase tracking-widest bg-white text-black border-2 border-black/10 hover:border-black shadow-sm transition-all">
                    Back to Library
                </Link>
            </div>

            {error && <div role="alert" className="border-2 border-red-200 bg-red-50 rounded-2xl p-5 text-red-800 text-sm font-bold">{error}</div>}
            {notice && <div role="status" className="border-2 border-emerald-200 bg-emerald-50 rounded-2xl p-5 text-emerald-900 text-sm font-bold">{notice}</div>}

            {/* Save current selection */}
            <section className="bg-white border-2 border-black/5 rounded-[2rem] p-6 md:p-8 shadow-sm space-y-4">
                <div>
                    <h2 className="font-black text-gray-900 uppercase text-[11px] tracking-[0.3em] opacity-40">Save the current selection</h2>
                    <p className="text-sm text-black/55 font-medium">{selectedNow} {selectedNow === 1 ? "item is" : "items are"} currently included on the dashboard.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                    <div>
                        <Label htmlFor="variant-name">Name</Label>
                        <Input id="variant-name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Backend roles 2026" />
                    </div>
                    <div>
                        <Label htmlFor="variant-labels">Labels (comma-separated)</Label>
                        <Input id="variant-labels" value={newLabels} onChange={e => setNewLabels(e.target.value)} placeholder="Stripe, fintech" />
                    </div>
                    <Button
                        variant="primary"
                        disabled={!newName.trim() || selectedNow === 0}
                        loading={busy === "create"}
                        onClick={() => run("create", async () => {
                            await createVariant({ name: newName, labels: parseLabels(newLabels) });
                            setNewName("");
                            setNewLabels("");
                        }, "Variant saved.")}
                    >
                        Save variant
                    </Button>
                </div>
            </section>

            {/* Search / filter */}
            <div className="flex flex-col md:flex-row md:items-center gap-3">
                <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search by name or label…"
                    className="px-4 py-3 rounded-xl border-2 border-black/10 focus:border-black outline-none text-sm font-medium w-full md:w-80"
                />
                {allLabels.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {allLabels.map(l => (
                            <button
                                key={l}
                                type="button"
                                onClick={() => setLabelFilter(labelFilter === l ? null : l)}
                                className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border-2 transition-all ${labelFilter === l ? "bg-black text-white border-black" : "bg-white border-black/10 text-black/60 hover:border-black"}`}
                            >
                                {l}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {variants.length === 0 ? (
                <div className="p-12 border-2 border-dashed border-black/5 rounded-[2.5rem] text-center bg-gray-50/50">
                    <p className="text-black/40 font-bold text-xl tracking-tight">No variants yet.</p>
                    <p className="text-black/30 text-sm mt-1">Toggle items on the dashboard, then save the selection here under a name.</p>
                </div>
            ) : (
                <ul className="grid gap-4">
                    {shown.map(v => (
                        <VariantRow
                            key={v.id}
                            variant={v}
                            data={data}
                            loaded={v.id === loadedVariantId}
                            busy={busy}
                            onLoad={() => run(`load-${v.id}`, async () => {
                                const r = await loadVariant(v.id);
                                setNotice(r.missing > 0 ? `Loaded "${v.name}". ${r.missing} ${r.missing === 1 ? "item" : "items"} it pointed to no longer exist and were dropped.` : `Loaded "${v.name}" into your working selection.`);
                            })}
                            onUpdateSelection={() => run(`snap-${v.id}`, () => resnapshotVariant(v.id), `"${v.name}" now matches the current selection.`)}
                            onRename={(name) => run(`rename-${v.id}`, () => updateVariant(v.id, { name }))}
                            onLabels={(labels) => run(`labels-${v.id}`, () => updateVariant(v.id, { labels }))}
                            onDuplicate={() => run(`dup-${v.id}`, async () => { await duplicateVariant(v.id); }, "Duplicated.")}
                            onDelete={() => setPendingDelete(v)}
                        />
                    ))}
                    {shown.length === 0 && <li className="text-center text-black/30 font-bold py-8">Nothing matches.</li>}
                </ul>
            )}

            <ConfirmDialog
                open={pendingDelete !== null}
                title={`Delete "${pendingDelete?.name}"?`}
                confirmLabel="Delete"
                danger
                busy={busy === "delete"}
                onCancel={() => setPendingDelete(null)}
                onConfirm={() => {
                    const v = pendingDelete;
                    if (!v) return;
                    run("delete", async () => { await deleteVariant(v.id); setPendingDelete(null); }, "Variant deleted.");
                }}
            >
                <p>Only the saved selection is removed. Your library items stay untouched.</p>
            </ConfirmDialog>
        </div>
    );
}

interface VariantRowProps {
    variant: ResumeVariant;
    data: ResumeData;
    loaded: boolean;
    busy: string | null;
    onLoad: () => void;
    onUpdateSelection: () => void;
    onRename: (name: string) => void;
    onLabels: (labels: string[]) => void;
    onDuplicate: () => void;
    onDelete: () => void;
}

function VariantRow({ variant: v, data, loaded, busy, onLoad, onUpdateSelection, onRename, onLabels, onDuplicate, onDelete }: VariantRowProps) {
    const [editing, setEditing] = useState<"name" | "labels" | null>(null);
    const [draft, setDraft] = useState("");
    const total = countItems(v.items);
    const missing = missingCount(v.items, data);
    const inSync = selectionEquals(data, v.items);
    const isBusy = busy !== null && busy.endsWith(v.id);

    const commit = () => {
        if (editing === "name" && draft.trim() && draft.trim() !== v.name) onRename(draft);
        if (editing === "labels") onLabels(parseLabels(draft));
        setEditing(null);
    };

    return (
        <li className={`bg-white border-2 rounded-[2rem] p-6 shadow-sm space-y-4 ${loaded ? "border-black" : "border-black/5"}`}>
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="min-w-0 space-y-2">
                    {editing === "name" ? (
                        <input
                            autoFocus
                            value={draft}
                            onChange={e => setDraft(e.target.value)}
                            onBlur={commit}
                            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(null); }}
                            className="text-xl font-black tracking-tight px-2 py-1 rounded-lg border-2 border-black outline-none w-full max-w-md"
                        />
                    ) : (
                        <button type="button" onClick={() => { setDraft(v.name); setEditing("name"); }} className="text-xl font-black tracking-tight text-left hover:underline decoration-black/30" title="Rename">
                            {v.name}
                        </button>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                        {loaded && <span className="px-2 py-0.5 rounded-md bg-black text-white text-[10px] font-black uppercase tracking-widest">{inSync ? "Loaded" : "Loaded · modified"}</span>}
                        {editing === "labels" ? (
                            <input
                                autoFocus
                                value={draft}
                                onChange={e => setDraft(e.target.value)}
                                onBlur={commit}
                                onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(null); }}
                                placeholder="comma-separated labels"
                                className="text-xs font-bold px-2 py-1 rounded-lg border-2 border-black outline-none w-72"
                            />
                        ) : (
                            <>
                                {v.labels.map(l => <span key={l} className="px-2 py-0.5 rounded-md bg-gray-100 text-black/60 text-[10px] font-black uppercase tracking-widest">{l}</span>)}
                                <button type="button" onClick={() => { setDraft(v.labels.join(", ")); setEditing("labels"); }} className="text-[10px] font-black uppercase tracking-widest text-black/30 hover:text-black">
                                    {v.labels.length ? "Edit labels" : "+ Add label"}
                                </button>
                            </>
                        )}
                    </div>
                    <p className="text-[11px] text-black/40 font-bold uppercase tracking-widest">
                        {total} {total === 1 ? "item" : "items"}
                        {missing > 0 && <span className="text-amber-600"> · {missing} missing</span>}
                        {v.updatedAt && ` · updated ${fmtDate(v.updatedAt)}`}
                    </p>
                    <p className="text-xs text-black/50 font-medium">
                        {COLLECTION_NAMES.filter(c => v.items[c].length > 0).map(c => `${SECTION_LABEL[COLLECTION_SECTION[c]]} ${v.items[c].length}`).join(" · ") || "Empty selection"}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                    <Button size="sm" variant="primary" onClick={onLoad} loading={busy === `load-${v.id}`} disabled={isBusy || (loaded && inSync)}>Load</Button>
                    <Button size="sm" onClick={onUpdateSelection} loading={busy === `snap-${v.id}`} disabled={isBusy || inSync} title="Replace this variant's items with the current selection">Update from selection</Button>
                    <Button size="sm" onClick={onDuplicate} loading={busy === `dup-${v.id}`} disabled={isBusy}>Duplicate</Button>
                    <Button size="sm" variant="ghost" onClick={onDelete} disabled={isBusy} className="hover:!text-red-600 hover:!bg-red-50">Delete</Button>
                </div>
            </div>
        </li>
    );
}
