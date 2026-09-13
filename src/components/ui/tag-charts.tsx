// src/components/ui/tag-charts.tsx
"use client";

// recharts views over aggregated tags. Client-only (recharts measures the DOM);
// import through next/dynamic({ ssr: false }) from the views that use them.

import React from "react";
import {
    Bar, BarChart, Cell, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer,
    Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import { TAG_KINDS, kindMeta, type TagKind } from "@/lib/tags/types";
import type { KindTotals, TagWeight } from "@/lib/tags/aggregate";

const GRID = "var(--border)";
const TICK = "var(--fg-muted)";
const TOOLTIP_STYLE = { borderRadius: 6, border: "1px solid var(--border)", boxShadow: "0 1px 2px rgb(0 0 0 / 0.05)", fontSize: 12, padding: "6px 10px" };

export interface RadarSeries {
    label: string;
    totals: KindTotals;
    color: string;
}

/** One axis per tag kind. Each series is normalised to its own max (0–100) so shapes compare. */
export function KindRadar({ series, height = 280, activeKinds }: { series: RadarSeries[]; height?: number; activeKinds?: ReadonlySet<TagKind> }) {
    const maxes = series.map(s => Math.max(1, ...TAG_KINDS.map(k => s.totals[k.id])));
    const data = TAG_KINDS.map(k => {
        const row: Record<string, string | number> = { kind: k.short };
        series.forEach((s, i) => { row[s.label] = Math.round((s.totals[k.id] / maxes[i]) * 100); row[`${s.label}__raw`] = s.totals[k.id]; });
        return row;
    });
    return (
        <ResponsiveContainer width="100%" height={height}>
            <RadarChart data={data} outerRadius="72%">
                <PolarGrid stroke={GRID} />
                <PolarAngleAxis dataKey="kind" tick={activeKinds && activeKinds.size > 0 ? <KindTick active={activeKinds} /> : { fontSize: 11, fontWeight: 500, fill: TICK }} />
                <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                {series.map(s => (
                    <Radar key={s.label} name={s.label} dataKey={s.label} stroke={s.color} fill={s.color} fillOpacity={0.15} strokeWidth={1.5} />
                ))}
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, name, entry) => [`${entry.payload[`${name}__raw`]} tags`, String(name)]} />
                {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            </RadarChart>
        </ResponsiveContainer>
    );
}

/** Axis label that fades kinds outside the active filter. */
function KindTick(props: Record<string, unknown> & { active: ReadonlySet<TagKind> }) {
    const { x, y, textAnchor, payload, active } = props as { x: number; y: number; textAnchor: "start" | "middle" | "end"; payload: { value: string; index: number }; active: ReadonlySet<TagKind> };
    const kind = TAG_KINDS[payload.index]?.id;
    const on = kind ? active.has(kind) : true;
    return (
        <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central" fontSize={11} fontWeight={on ? 600 : 500} fill={on ? "var(--fg)" : "var(--fg-subtle)"}>
            {payload.value}
        </text>
    );
}

/** Horizontal bars for the heaviest tags, coloured by kind. */
export function TopTagsBars({ weights, limit = 20, height }: { weights: TagWeight[]; limit?: number; height?: number }) {
    const rows = weights.slice(0, limit).map(w => ({ name: w.display, weight: w.weight, kind: w.kind }));
    const h = height ?? Math.max(160, rows.length * 24 + 20);
    if (rows.length === 0) return <EmptyChart />;
    return (
        <ResponsiveContainer width="100%" height={h}>
            <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 24, top: 4, bottom: 4 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: TICK }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: TICK }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, _n, entry) => [`${value} ${Number(value) === 1 ? "item" : "items"}`, kindMeta(entry.payload.kind as TagKind).label]} cursor={{ fill: "var(--surface-muted)" }} />
                <Bar dataKey="weight" radius={[0, 4, 4, 0]} maxBarSize={14}>
                    {rows.map(r => <Cell key={r.name} fill={kindMeta(r.kind).color} fillOpacity={0.85} />)}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}

function EmptyChart() {
    return (
        <div className="flex h-40 items-center justify-center text-13 text-fg-subtle">
            No tags yet
        </div>
    );
}
