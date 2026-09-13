// src/components/ui/insights-view.tsx
"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { ResumeData } from "@/types/schema";
import { aggregateTags, kindTotals, type TagWeight } from "@/lib/tags/aggregate";
import { staleCount } from "@/lib/tags/content";
import { TAG_KINDS, kindMeta, type TagKind } from "@/lib/tags/types";
import { cn } from "@/lib/cn";
import { SECTION_LABEL } from "@/lib/sections";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives/card";
import { Segmented } from "@/components/ui/primitives/segmented";
import { Button, FOCUS_RING } from "@/components/ui/primitives/button";
import { Input } from "@/components/ui/primitives/field";
import { Badge, KindDot } from "@/components/ui/primitives/badge";
import { NoticeBanner } from "@/components/ui/primitives/notice-banner";
import { Table, Td, Th } from "@/components/ui/primitives/table";
import { EmptyState } from "@/components/ui/primitives/empty-state";
import { BarChart3 } from "@/components/ui/primitives/icons";

const Charts = dynamic(() => import("@/components/ui/tag-charts").then(m => ({ default: ChartsBundle(m) })), {
    ssr: false,
    loading: () => <div className="flex h-64 items-center justify-center text-13 text-fg-subtle">Loading charts…</div>,
});

type ChartModule = typeof import("@/components/ui/tag-charts");

function ChartsBundle(m: ChartModule) {
    return function InsightsCharts({ weights, kinds }: { weights: TagWeight[]; kinds: ReadonlySet<TagKind> }) {
        const totals = kindTotals(weights);
        return (
            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader title="Profile shape" hint="Relative weight per tag kind" />
                    <CardBody><m.KindRadar series={[{ label: "You", totals, color: "#171717" }]} activeKinds={kinds} /></CardBody>
                </Card>
                <Card>
                    <CardHeader title="Heaviest tags" hint="How many included items carry each tag" />
                    <CardBody><m.TopTagsBars weights={weights} limit={18} /></CardBody>
                </Card>
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
    // Empty set = every kind.
    const [kinds, setKinds] = useState<ReadonlySet<TagKind>>(new Set());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);

    const weights = aggregateTags(data, { selectedOnly: scope === "selected" });
    const stale = staleCount(data);
    const filtered = kinds.size === 0 ? weights : weights.filter(w => kinds.has(w.kind));
    const q = query.trim().toLowerCase();
    const rows = q
        ? filtered.filter(w => w.display.toLowerCase().includes(q) || w.items.some(i => i.label.toLowerCase().includes(q)))
        : filtered;

    const toggleKind = (kind: TagKind) => setKinds(prev => {
        const next = new Set(prev);
        if (next.has(kind)) next.delete(kind); else next.add(kind);
        return next;
    });

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
        <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-13 text-fg-muted">Skills and keywords extracted from your library. The more included items carry a tag, the heavier it weighs.</p>
                <div className="flex flex-wrap items-center gap-2">
                    <Segmented
                        value={scope}
                        onChange={setScope}
                        options={[{ value: "selected", label: "Included items" }, { value: "all", label: "Whole library" }]}
                    />
                    <Button
                        size="sm"
                        onClick={() => runBackfill(stale === 0)}
                        loading={busy}
                        title={stale === 0 ? "Re-run the analysis for every item" : `${stale} items have changed since they were analysed`}
                    >
                        {stale > 0 ? `Analyse ${stale} changed` : "Re-analyse all"}
                    </Button>
                </div>
            </div>

            {stale > 0 && !busy && (
                <NoticeBanner tone="warning">{stale} {stale === 1 ? "item has" : "items have"} no up-to-date tags yet. Charts below only reflect analysed items.</NoticeBanner>
            )}
            {error && <NoticeBanner tone="danger" onDismiss={() => setError(null)}>{error}</NoticeBanner>}
            {done && <NoticeBanner tone="success" onDismiss={() => setDone(null)}>{done}</NoticeBanner>}

            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by kind">
                <FilterChip on={kinds.size === 0} onClick={() => setKinds(new Set())}>
                    All <span className="tabular-nums opacity-60">{weights.length}</span>
                </FilterChip>
                {TAG_KINDS.map(k => {
                    const n = weights.filter(w => w.kind === k.id).length;
                    return (
                        <FilterChip key={k.id} on={kinds.has(k.id)} onClick={() => toggleKind(k.id)} disabled={n === 0 && !kinds.has(k.id)}>
                            <KindDot color={k.color} />
                            {k.label} <span className="tabular-nums opacity-60">{n}</span>
                        </FilterChip>
                    );
                })}
            </div>

            {weights.length === 0 ? (
                <EmptyState icon={BarChart3} title="No tags yet" body="Save your library once (or press Analyse) and your skills chart will appear here." />
            ) : (
                <Charts weights={filtered} kinds={kinds} />
            )}

            <Card>
                <CardHeader
                    title={kinds.size === 0 ? "All tags" : `Tags · ${[...kinds].map(k => kindMeta(k).label).join(", ")}`}
                    action={<Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tags or items…" className="h-8 w-full text-13 md:w-64" />}
                />
                <Table>
                    <thead>
                        <tr>
                            <Th>Tag</Th>
                            <Th>Kind</Th>
                            <Th className="text-right">Weight</Th>
                            <Th>Carried by</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(w => (
                            <tr key={w.name}>
                                <Td className="whitespace-nowrap font-medium text-fg">{w.display}</Td>
                                <Td className="whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1.5 text-fg-muted">
                                        <KindDot color={kindMeta(w.kind).color} />
                                        {kindMeta(w.kind).label}
                                    </span>
                                </Td>
                                <Td className="text-right tabular-nums">{w.weight}</Td>
                                <Td>
                                    <div className="flex flex-wrap gap-1">
                                        {w.items.map(i => (
                                            <Badge key={`${i.section}-${i.id}`}>
                                                <span className="mr-1 text-fg-subtle">{i.section === "profile" ? "Profile" : SECTION_LABEL[i.section]}:</span> {i.label}
                                            </Badge>
                                        ))}
                                    </div>
                                </Td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr><Td colSpan={4} className="py-8 text-center text-fg-subtle">Nothing matches.</Td></tr>
                        )}
                    </tbody>
                </Table>
            </Card>
        </div>
    );
}

function FilterChip({ on, onClick, disabled, children }: { on: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
    return (
        <button
            type="button"
            aria-pressed={on}
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors disabled:opacity-40",
                on ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg",
                FOCUS_RING,
            )}
        >
            {children}
        </button>
    );
}
