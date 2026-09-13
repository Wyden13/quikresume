// src/components/ui/proposal-cards.tsx
"use client";

import React from "react";
import type { MuteRule, Proposal, ProposalKind } from "@/lib/match/types";
import { describeMuteRule } from "@/lib/match/proposals";
import { SECTION_LABEL } from "@/lib/sections";

const KIND_META: Record<ProposalKind, { label: string; color: string; bg: string }> = {
    include: { label: "Include", color: "#059669", bg: "bg-emerald-50" },
    exclude: { label: "Exclude", color: "#b45309", bg: "bg-amber-50" },
    "rewrite-bullet": { label: "Rewrite", color: "#2563eb", bg: "bg-blue-50" },
    "add-skill": { label: "Add skill", color: "#5d5294", bg: "bg-purple-50" },
    gap: { label: "Gap", color: "#dc2626", bg: "bg-red-50" },
};

interface ProposalCardsProps {
    proposals: Proposal[];
    requirementDisplay: (name: string) => string;
    busyId: string | null;
    onApply: (p: Proposal) => void;
    onSkip: (p: Proposal) => void;
    onIgnoreSimilar: (p: Proposal) => void;
    onReopen: (p: Proposal) => void;
    muted: MuteRule[];
    onUnmute: (r: MuteRule) => void;
}

export function ProposalCards({ proposals, requirementDisplay, busyId, onApply, onSkip, onIgnoreSimilar, onReopen, muted, onUnmute }: ProposalCardsProps) {
    const open = proposals.filter(p => p.status === "open");
    const done = proposals.filter(p => p.status !== "open");

    return (
        <div className="space-y-4">
            {open.length === 0 && (
                <div className="p-8 border-2 border-dashed border-black/5 rounded-[2rem] text-center bg-gray-50/50">
                    <p className="text-black/40 font-bold">{proposals.length === 0 ? "No suggestions yet." : "You have gone through every suggestion."}</p>
                </div>
            )}
            <ul className="space-y-3">
                {open.map(p => (
                    <li key={p.id}>
                        <ProposalCard p={p} requirementDisplay={requirementDisplay} busy={busyId === p.id}>
                            {p.kind !== "gap" && (
                                <ActionButton primary onClick={() => onApply(p)} disabled={busyId !== null}>Apply</ActionButton>
                            )}
                            <ActionButton onClick={() => onSkip(p)} disabled={busyId !== null}>{p.kind === "gap" ? "Dismiss" : "Skip"}</ActionButton>
                            <ActionButton onClick={() => onIgnoreSimilar(p)} disabled={busyId !== null} title="Never suggest this again">Ignore similar</ActionButton>
                        </ProposalCard>
                    </li>
                ))}
            </ul>

            {done.length > 0 && (
                <details className="rounded-2xl border border-black/5 bg-gray-50/60 p-4">
                    <summary className="text-[11px] font-black uppercase tracking-widest text-black/40 cursor-pointer">
                        {done.length} handled
                    </summary>
                    <ul className="mt-3 space-y-2">
                        {done.map(p => (
                            <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                                <span className="min-w-0 truncate">
                                    <span className="text-[10px] font-black uppercase tracking-widest mr-2" style={{ color: KIND_META[p.kind].color }}>{KIND_META[p.kind].label}</span>
                                    <span className="font-medium text-black/60">{p.itemLabel ?? p.tags.map(requirementDisplay).join(", ")}</span>
                                    <span className="text-black/30"> · {p.status}</span>
                                </span>
                                <button type="button" onClick={() => onReopen(p)} className="text-[10px] font-black uppercase tracking-widest text-black/40 hover:text-black shrink-0">Reopen</button>
                            </li>
                        ))}
                    </ul>
                </details>
            )}

            {muted.length > 0 && (
                <details className="rounded-2xl border border-black/5 bg-gray-50/60 p-4">
                    <summary className="text-[11px] font-black uppercase tracking-widest text-black/40 cursor-pointer">
                        {muted.length} muted {muted.length === 1 ? "rule" : "rules"}
                    </summary>
                    <ul className="mt-3 space-y-2">
                        {muted.map((r, i) => (
                            <li key={i} className="flex items-center justify-between gap-3 text-sm">
                                <span className="font-medium text-black/60">{describeMuteRule(r)}{r.tag ? ` (${requirementDisplay(r.tag)})` : ""}</span>
                                <button type="button" onClick={() => onUnmute(r)} className="text-[10px] font-black uppercase tracking-widest text-black/40 hover:text-black shrink-0">Unmute</button>
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </div>
    );
}

function ProposalCard({ p, requirementDisplay, busy, children }: { p: Proposal; requirementDisplay: (n: string) => string; busy: boolean; children: React.ReactNode }) {
    const meta = KIND_META[p.kind];
    return (
        <div className={`rounded-[1.5rem] border-2 border-black/5 bg-white p-5 space-y-3 ${busy ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest ${meta.bg}`} style={{ color: meta.color }}>{meta.label}</span>
                {p.section && <span className="text-[10px] font-black uppercase tracking-widest text-black/30">{SECTION_LABEL[p.section]}</span>}
                {p.itemLabel && <span className="font-black text-sm truncate">{p.itemLabel}</span>}
                {p.tags.length > 0 && (
                    <span className="ml-auto flex flex-wrap gap-1">
                        {p.tags.slice(0, 4).map(t => <span key={t} className="px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-bold text-black/60">{requirementDisplay(t)}</span>)}
                    </span>
                )}
            </div>
            {p.kind === "rewrite-bullet" && (
                <div className="grid gap-2 md:grid-cols-2 text-sm">
                    <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-black/30 mb-1">Now</p>
                        <p className="font-medium text-black/60">{p.current}</p>
                    </div>
                    <div className="rounded-xl bg-blue-50 p-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-700/60 mb-1">Proposed</p>
                        <p className="font-medium text-blue-900">{p.proposed}</p>
                    </div>
                </div>
            )}
            {p.kind === "add-skill" && (
                <p className="text-sm font-medium">Add <span className="font-black">{p.proposed}</span> to <span className="font-black">{p.itemLabel}</span>.</p>
            )}
            <p className="text-sm text-black/60 font-medium">{p.reason}</p>
            <div className="flex flex-wrap gap-2 pt-1">{children}</div>
        </div>
    );
}

function ActionButton({ children, onClick, primary, disabled, title }: { children: React.ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean; title?: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-50 ${
                primary ? "bg-black text-white hover:bg-black/80" : "bg-white text-black/60 border-2 border-black/10 hover:border-black hover:text-black"
            }`}
        >
            {children}
        </button>
    );
}
