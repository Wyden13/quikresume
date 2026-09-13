// src/components/ui/tag-charts.tsx
"use client";

// recharts views over aggregated tags. Client-only (recharts measures the DOM);
// import through next/dynamic({ ssr: false }) from the views that use them.

import React from "react";
import {
    Bar, BarChart, Cell, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer,
    Tooltip, Treemap, XAxis, YAxis, Legend,
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
export function KindRadar({ series, height = 280 }: { series: RadarSeries[]; height?: number }) {
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
                <PolarAngleAxis dataKey="kind" tick={{ fontSize: 11, fontWeight: 500, fill: TICK }} />
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

/** Kind -> tags, sized by weight. */
export function TagTreemap({ weights, height = 320 }: { weights: TagWeight[]; height?: number }) {
    const data = TAG_KINDS
        .map(k => ({
            name: k.label,
            kind: k.id,
            children: weights.filter(w => w.kind === k.id).map(w => ({ name: w.display, size: w.weight, kind: k.id })),
        }))
        .filter(g => g.children.length > 0);
    if (data.length === 0) return <EmptyChart />;
    return (
        <ResponsiveContainer width="100%" height={height}>
            <Treemap data={data} dataKey="size" nameKey="name" stroke="#fff" isAnimationActive={false} content={<TreemapCell />} />
        </ResponsiveContainer>
    );
}

function TreemapCell(props: Record<string, unknown>) {
    const x = Number(props.x), y = Number(props.y), width = Number(props.width), height = Number(props.height);
    const depth = Number(props.depth);
    const name = String(props.name ?? "");
    const kind = props.kind as TagKind | undefined;
    const color = kind ? kindMeta(kind).color : "#999";
    if (depth === 1) {
        return (
            <g>
                <rect x={x} y={y} width={width} height={height} fill={color} fillOpacity={0.08} stroke="#fff" strokeWidth={3} />
                {width > 60 && height > 18 && (
                    <text x={x + 6} y={y + 14} fontSize={11} fontWeight={600} fill={color}>
                        {name}
                    </text>
                )}
            </g>
        );
    }
    const label = width > 44 && height > 16 ? name.slice(0, Math.max(3, Math.floor(width / 7))) : "";
    return (
        <g>
            <rect x={x} y={y} width={width} height={height} fill={color} fillOpacity={0.7} stroke="#fff" strokeWidth={1.5} rx={3} />
            {label && (
                <text x={x + width / 2} y={y + height / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={500} fill="#fff">
                    {label}
                </text>
            )}
        </g>
    );
}

function EmptyChart() {
    return (
        <div className="flex h-40 items-center justify-center text-13 text-fg-subtle">
            No tags yet
        </div>
    );
}
