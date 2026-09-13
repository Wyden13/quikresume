// src/components/ui/insights-view.tsx
"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { ResumeData } from "@/types/schema";
import { aggregateTags, kindTotals, type TagWeight } from "@/lib/tags/aggregate";
import { staleCount } from "@/lib/tags/content";
import { TAG_KINDS, kindMeta } from "@/lib/tags/types";
import { SECTION_LABEL } from "@/lib/sections";

const Charts = dynamic(() => import("@/components/ui/tag-charts").then(m => ({ default: ChartsBundle(m) })), {
    ssr: false,
    loading: () => <div className="h-64 flex items-center justify-center text-black/30 text-xs font-black uppercase tracking-widest">Loading charts…</div>,
});

type ChartModule = typeof import("@/components/ui/tag-charts");

function ChartsBundle(m: ChartModule) {
    return function InsightsCharts({ weights }: { weights: TagWeight[] }) {
        const totals = kindTotals(weights);
        return (
            <div className="grid gap-8 lg:grid-cols-2">
                <Panel title="Profile shape" hint="Relative weight per tag kind">
                    <m.KindRadar series={[{ label: "You", totals, color: "#5d5294" }]} />
                </Panel>
                <Panel title="Heaviest tags" hint="How many included items carry each tag">
                    <m.TopTagsBars weights={weights} limit={18} />
                </Panel>
                <div className="lg:col-span-2">
                    <Panel title="Map" hint="Kinds → tags, sized by weight">
                        <m.TagTreemap weights={weights} />
                    </Panel>
                </div>
            </div>
        );
    };
}

interface InsightsViewProps {
    data: ResumeData;
}

export function InsightsView({ data }: InsightsViewProps) {
    const router = useRouter();
    const [scope, setScope] = useState<"selected" | "all">("selected");
    const [query, setQuery] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);

    const weights = aggregateTags(data, { selectedOnly: scope === "selected" });
    const stale = staleCount(data);
    const q = query.trim().toLowerCase();
    const rows = q
        ? weights.filter(w => w.display.toLowerCase().includes(q) || w.items.some(i => i.label.toLowerCase().includes(q)))
        : weights;

    const runBackfill = async (force: boolean) => {
        setBusy(true);
        setError(null);
        setDone(null);
        try {
            const res = await fetch("/api/tags/backfill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force }) });
            const json = await res.json() as { ok: boolean; error?: string; tagged?: number; skipped?: number };
            if (!json.ok) throw new Error(json.error ?? "Analysis failed.");
            setDone(`Analysed ${json.tagged ?? 0} ${json.tagged === 1 ? "item" : "items"}${json.skipped ? ` (${json.skipped} skipped, run again)` : ""}.`);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Analysis failed.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-4">
                <div className="flex flex-col gap-1">
                    <h2 className="font-black text-gray-900 uppercase text-[11px] tracking-[0.3em] opacity-30">Insights</h2>
                    <p className="text-sm text-black/55 font-medium italic">Skills and keywords extracted from your library. The more included items carry a tag, the heavier it weighs.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Segmented
                        value={scope}
                        onChange={setScope}
                        options={[{ value: "selected", label: "Included items" }, { value: "all", label: "Whole library" }]}
                    />
                    <button
                        type="button"
                        onClick={() => runBackfill(stale === 0)}
                        disabled={busy}
                        className="px-4 py-2.5 rounded-xl bg-white border-2 border-black/10 hover:border-black text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                        title={stale === 0 ? "Re-run the analysis for every item" : `${stale} items have changed since they were analysed`}
                    >
                        {busy ? "Analysing…" : stale > 0 ? `Analyse ${stale} changed` : "Re-analyse all"}
                    </button>
                </div>
            </div>

            {stale > 0 && !busy && (
                <div role="status" className="mx-4 border-2 border-amber-200 bg-amber-50 rounded-2xl p-4 text-amber-900 text-sm font-bold">
                    {stale} {stale === 1 ? "item has" : "items have"} no up-to-date tags yet. Charts below only reflect analysed items.
                </div>
            )}
            {error && <div role="alert" className="mx-4 border-2 border-red-200 bg-red-50 rounded-2xl p-4 text-red-800 text-sm font-bold">{error}</div>}
            {done && <div role="status" className="mx-4 border-2 border-emerald-200 bg-emerald-50 rounded-2xl p-4 text-emerald-900 text-sm font-bold">{done}</div>}

            <div className="flex flex-wrap gap-2 px-4">
                {TAG_KINDS.map(k => {
                    const n = weights.filter(w => w.kind === k.id).length;
                    return (
                        <span key={k.id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-black/10 text-[11px] font-bold text-black/70">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: k.color }} />
                            {k.label} <span className="text-black/40">{n}</span>
                        </span>
                    );
                })}
            </div>

            {weights.length === 0 ? (
                <div className="mx-4 p-12 border-2 border-dashed border-black/5 rounded-[2.5rem] text-center bg-gray-50/50">
                    <p className="text-black/40 font-bold text-lg">No tags yet.</p>
                    <p className="text-black/30 text-sm mt-1">Save your library once (or press Analyse) and your skills chart will appear here.</p>
                </div>
            ) : (
                <Charts weights={weights} />
            )}

            <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-4">
                    <h3 className="font-black text-gray-900 uppercase text-[11px] tracking-[0.3em] opacity-30">All tags</h3>
                    <input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search tags or items…"
                        className="px-4 py-2.5 rounded-xl border-2 border-black/10 focus:border-black outline-none text-sm font-medium w-full md:w-72"
                    />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[10px] font-black uppercase tracking-widest text-black/40 border-b border-black/5">
                                <th className="px-4 py-3">Tag</th>
                                <th className="px-4 py-3">Kind</th>
                                <th className="px-4 py-3">Weight</th>
                                <th className="px-4 py-3">Carried by</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(w => (
                                <tr key={w.name} className="border-b border-black/5 align-top">
                                    <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">{w.display}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold" style={{ color: kindMeta(w.kind).color }}>
                                            <span className="w-2 h-2 rounded-full" style={{ background: kindMeta(w.kind).color }} />
                                            {kindMeta(w.kind).label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 font-black">{w.weight}</td>
                                    <td className="px-4 py-3 text-black/60">
                                        {w.items.map(i => (
                                            <span key={`${i.section}-${i.id}`} className="inline-block mr-2 mb-1 px-2 py-0.5 rounded-md bg-gray-100 text-[11px] font-semibold">
                                                <span className="text-black/35">{i.section === "profile" ? "Profile" : SECTION_LABEL[i.section]}:</span> {i.label}
                                            </span>
                                        ))}
                                    </td>
                                </tr>
                            ))}
                            {rows.length === 0 && (
                                <tr><td colSpan={4} className="px-4 py-8 text-center text-black/30 font-bold">Nothing matches.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
    return (
        <section className="bg-white border-2 border-black/5 rounded-[2rem] p-6 shadow-sm">
            <div className="mb-3">
                <h3 className="font-black text-gray-900 uppercase text-[11px] tracking-[0.3em] opacity-40">{title}</h3>
                {hint && <p className="text-xs text-black/40 font-medium">{hint}</p>}
            </div>
            {children}
        </section>
    );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
    return (
        <div className="inline-flex rounded-xl border-2 border-black/10 p-1 bg-white">
            {options.map(o => (
                <button
                    key={o.value}
                    type="button"
                    onClick={() => onChange(o.value)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${value === o.value ? "bg-black text-white" : "text-black/50 hover:text-black"}`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}
