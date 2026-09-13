// src/components/ui/variant-toolbar.tsx
"use client";

// Library-view controls for saved variants: which one is loaded, save the
// current selection as a new one, load another, or update the loaded one.

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ResumeData } from "@/types/schema";
import type { ResumeVariant } from "@/types/db";
import { createVariant, loadVariant, resnapshotVariant } from "@/app/actions/variant-actions";
import { selectionEquals } from "@/lib/variants";

interface VariantToolbarProps {
    variants: ResumeVariant[];
    loadedVariantId: string | null;
    /** Server truth (not the draft): the working selection variants are snapshotted from. */
    data: ResumeData;
    onNotice: (text: string, tone?: "ok" | "warn") => void;
}

export function VariantToolbar({ variants, loadedVariantId, data, onNotice }: VariantToolbarProps) {
    const router = useRouter();
    const [naming, setNaming] = useState(false);
    const [name, setName] = useState("");
    const [busy, setBusy] = useState<string | null>(null);
    const loaded = variants.find(v => v.id === loadedVariantId) ?? null;
    const inSync = loaded ? selectionEquals(data, loaded.items) : false;

    const run = async (key: string, fn: () => Promise<string>) => {
        setBusy(key);
        try {
            onNotice(await fn());
            router.refresh();
        } catch (err) {
            onNotice(err instanceof Error ? err.message : "Something went wrong.", "warn");
        } finally {
            setBusy(null);
        }
    };

    const btn = "px-4 py-2.5 rounded-xl bg-white border-2 border-black/10 hover:border-black text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-50";

    return (
        <div className="flex flex-wrap items-center gap-2">
            {loaded && (
                <span className="px-3 py-2 rounded-xl bg-black text-white text-[11px] font-black uppercase tracking-widest" title={loaded.labels.join(", ")}>
                    {loaded.name}{inSync ? "" : " · modified"}
                </span>
            )}
            {loaded && !inSync && (
                <button type="button" className={btn} disabled={busy !== null} onClick={() => run("update", async () => { await resnapshotVariant(loaded.id); return `"${loaded.name}" updated to the current selection.`; })}>
                    {busy === "update" ? "Updating…" : `Update ${loaded.name}`}
                </button>
            )}
            {naming ? (
                <form
                    className="flex items-center gap-2"
                    onSubmit={e => {
                        e.preventDefault();
                        if (!name.trim()) return;
                        run("create", async () => { await createVariant({ name }); setNaming(false); setName(""); return `Saved the current selection as "${name.trim()}".`; });
                    }}
                >
                    <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Variant name" className="px-3 py-2 rounded-xl border-2 border-black outline-none text-sm font-bold w-44" />
                    <button type="submit" className={`${btn} !bg-black !text-white !border-black`} disabled={busy !== null || !name.trim()}>{busy === "create" ? "Saving…" : "Save"}</button>
                    <button type="button" className={btn} onClick={() => { setNaming(false); setName(""); }}>Cancel</button>
                </form>
            ) : (
                <button type="button" className={btn} disabled={busy !== null} onClick={() => setNaming(true)}>Save as variant</button>
            )}
            {variants.length > 0 && (
                <select
                    value=""
                    disabled={busy !== null}
                    onChange={e => {
                        const id = e.target.value;
                        const v = variants.find(x => x.id === id);
                        if (!v) return;
                        run("load", async () => {
                            const r = await loadVariant(v.id);
                            return r.missing > 0 ? `Loaded "${v.name}". ${r.missing} missing ${r.missing === 1 ? "item was" : "items were"} dropped.` : `Loaded "${v.name}".`;
                        });
                    }}
                    className="px-3 py-2.5 rounded-xl border-2 border-black/10 focus:border-black outline-none text-[11px] font-black uppercase tracking-widest bg-white disabled:opacity-50"
                >
                    <option value="">{busy === "load" ? "Loading…" : "Load variant…"}</option>
                    {variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
            )}
            <Link href="/dashboard/variants" className="text-[11px] font-black uppercase tracking-widest text-black/40 hover:text-black px-2">Manage</Link>
        </div>
    );
}
