// src/components/ui/insights-view.tsx
"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { ResumeData } from "@/types/schema";
import { aggregateTags, kindTotals, type TagWeight } from "@/lib/tags/aggregate";
import { staleCount } from "@/lib/tags/content";
import { TAG_KINDS, type TagKind } from "@/lib/tags/types";
import { cn } from "@/lib/cn";
import type { JobRecord } from "@/lib/match/types";
import type { AliasMap } from "@/lib/tags/normalize";
import { scoreJob } from "@/lib/match/score";
import { Card, CardBody, CardHeader, SectionHeader } from "@/components/ui/primitives/card";
import { Segmented } from "@/components/ui/primitives/segmented";
import { Button, FOCUS_RING } from "@/components/ui/primitives/button";
import { Badge, KindDot } from "@/components/ui/primitives/badge";
import { NoticeBanner } from "@/components/ui/primitives/notice-banner";
import { ExpandableRow } from "@/components/ui/primitives/expandable-row";
import { ScoreRing } from "@/components/ui/primitives/score-ring";
import { EmptyState } from "@/components/ui/primitives/empty-state";
import { BarChart3, Target } from "@/components/ui/primitives/icons";
import { readJson } from "@/lib/ui/fetch-json";

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
    /** Analysed jobs, newest first (already ordered by the server). */
    jobs: JobRecord[];
    aliases: AliasMap;
    /** Open this job on the Job Match view. */
    onOpenJob: (id: string) => void;
}

export function InsightsView({ data, jobs, aliases, onOpenJob }: InsightsViewProps) {
    const router = useRouter();
    const [scope, setScope] = useState<"selected" | "all">("selected");
    // Empty set = every kind.
    const [kinds, setKinds] = useState<ReadonlySet<TagKind>>(new Set());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);

    const weights = aggregateTags(data, { selectedOnly: scope === "selected" });
    const stale = staleCount(data);
    const filtered = kinds.size === 0 ? weights : weights.filter(w => kinds.has(w.kind));

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
            const json = await readJson<{ tagged: number; skipped: number }>(res);
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

            <JobHistory data={data} jobs={jobs} aliases={aliases} onOpenJob={onOpenJob} />
        </div>
    );
}

/**
 * Every analysed job, scored live against the working selection so the numbers agree with the Job
 * Match page. `job.lastScore` is only a cached scalar, so it is deliberately not used here.
 */
function JobHistory({ data, jobs, aliases, onOpenJob }: { data: ResumeData; jobs: JobRecord[]; aliases: AliasMap; onOpenJob: (id: string) => void }) {
    const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
    const toggle = (id: string) => setOpen(prev => {
        const next = new Set(prev);
        if (!next.delete(id)) next.add(id);
        return next;
    });

    return (
        <section className="space-y-3">
            <SectionHeader icon={Target} title="Job match history" count={jobs.length} />
            {jobs.length === 0 ? (
                <EmptyState icon={Target} title="No jobs analysed yet" body="Paste a job description on the Job Match page to see how your library scores against it." />
            ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
                    {jobs.map(job => {
                        const match = scoreJob(job.requirements, data, aliases);
                        const gaps = [...match.missingMust, ...match.keywordGaps];
                        const shown = job.requirements.slice(0, 4);
                        return (
                            <ExpandableRow
                                key={job.id}
                                id={`job-${job.id}`}
                                open={open.has(job.id)}
                                onToggle={() => toggle(job.id)}
                                summary={
                                    <div className="flex min-w-0 items-center gap-3">
                                        <ScoreRing score={match.score} size={32} className="shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm font-medium text-fg">{job.title}</div>
                                            <div className="truncate text-13 text-fg-muted">{job.company || "Unknown company"}</div>
                                            {gaps.length > 0 && (
                                                <div className="truncate text-xs text-warning">Missing: {gaps.map(r => r.display).join(", ")}</div>
                                            )}
                                        </div>
                                        <span className="hidden shrink-0 items-center gap-1 md:flex">
                                            {shown.map(r => <Badge key={r.name} size="xs" tone={r.importance === "must" ? "strong" : "neutral"}>{r.display}</Badge>)}
                                            {job.requirements.length > shown.length && (
                                                <span className="text-xs text-fg-subtle">+{job.requirements.length - shown.length}</span>
                                            )}
                                        </span>
                                    </div>
                                }
                            >
                                <div className="space-y-3 text-13">
                                    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
                                        <dt className="text-fg-subtle">Must-haves</dt><dd className="tabular-nums">{match.must.hit}/{match.must.total} covered</dd>
                                        <dt className="text-fg-subtle">Nice-to-haves</dt><dd className="tabular-nums">{match.nice.hit}/{match.nice.total} covered</dd>
                                    </dl>
                                    {match.missingMust.length > 0 && (
                                        <p><span className="text-fg-subtle">Missing must-haves: </span><span className="font-medium text-danger">{match.missingMust.map(r => r.display).join(", ")}</span></p>
                                    )}
                                    {match.keywordGaps.length > 0 && (
                                        <p><span className="text-fg-subtle">Keywords to add: </span><span className="font-medium">{match.keywordGaps.map(r => r.display).join(", ")}</span></p>
                                    )}
                                    {match.missingMust.length === 0 && match.keywordGaps.length === 0 && (
                                        <p className="text-fg-muted">Nothing missing. Every requirement is covered by your working selection.</p>
                                    )}
                                    <Button size="sm" onClick={() => onOpenJob(job.id)}>Open in Job Match</Button>
                                </div>
                            </ExpandableRow>
                        );
                    })}
                </ul>
            )}
        </section>
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
