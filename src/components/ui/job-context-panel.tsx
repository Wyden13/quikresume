// src/components/ui/job-context-panel.tsx
"use client";

// Sticky "tailoring" bar shown under the Library / Editor while a job is
// active: live score from the current selection or draft, missing must-haves,
// page count, and shortcuts back to the suggestions.

import React from "react";
import type { ResumeData } from "@/types/schema";
import type { JobRecord } from "@/lib/match/types";
import type { AliasMap } from "@/lib/tags/normalize";
import { scoreJob } from "@/lib/match/score";
import { staleCount } from "@/lib/tags/content";
import { useResumePageCount } from "@/components/ui/use-page-count";

interface JobContextPanelProps {
    job: JobRecord;
    data: ResumeData;
    aliases: AliasMap;
    reanalyzing: boolean;
    onReanalyze: () => void;
    onSuggestions: () => void;
    onExit: () => void;
}

export function JobContextPanel({ job, data, aliases, reanalyzing, onReanalyze, onSuggestions, onExit }: JobContextPanelProps) {
    const match = scoreJob(job.requirements, data, aliases);
    const stale = staleCount(data);
    const pages = useResumePageCount(data);

    return (
        <div className="sticky bottom-4 z-30">
            <div className="mx-auto max-w-[1180px] bg-black text-white rounded-[2rem] shadow-2xl shadow-black/30 px-5 py-4 md:px-7 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-4 min-w-0">
                    <ScoreRing score={match.score} />
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40">Tailoring for</p>
                        <p className="font-black leading-tight truncate">{job.title}{job.company ? <span className="text-white/50 font-bold"> · {job.company}</span> : null}</p>
                        <p className="text-[11px] font-bold text-white/60">
                            {match.must.hit}/{match.must.total} must-haves · {match.nice.hit}/{match.nice.total} nice-to-haves
                            {pages !== null && (
                                <span className={pages > 1 ? " text-amber-300" : ""}> · {pages} {pages === 1 ? "page" : "pages"}{pages > 1 ? " — over one page" : ""}</span>
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
                    {match.missingMust.slice(0, 4).map(r => (
                        <span key={r.name} className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-black uppercase tracking-widest text-red-200" title="Missing must-have">
                            {r.display}
                        </span>
                    ))}
                    {match.missingMust.length > 4 && <span className="text-[10px] font-black text-white/40">+{match.missingMust.length - 4} missing</span>}
                    {match.missingMust.length === 0 && match.must.total > 0 && <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">All must-haves covered</span>}
                    {match.keywordGaps.slice(0, 3).map(r => (
                        <span key={r.name} className="px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-200 text-[11px] font-bold" title="Soft skill or practice keyword missing: work it into a bullet before applying.">+ {r.display}</span>
                    ))}
                    {match.keywordGaps.length > 3 && <span className="text-[10px] font-black text-white/40">+{match.keywordGaps.length - 3} keywords</span>}
                    {stale > 0 && (
                        <button type="button" onClick={onReanalyze} disabled={reanalyzing} className="ml-1 px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-200 text-[10px] font-black uppercase tracking-widest hover:bg-amber-400/30 disabled:opacity-50">
                            {reanalyzing ? "Analysing…" : `${stale} not analysed · re-analyse`}
                        </button>
                    )}
                </div>

                <div className="flex gap-2 shrink-0">
                    <button type="button" onClick={onSuggestions} className="px-4 py-2 rounded-xl bg-white text-black text-[11px] font-black uppercase tracking-widest hover:bg-white/90">Suggestions</button>
                    <button type="button" onClick={onExit} className="px-4 py-2 rounded-xl border border-white/20 text-white/70 text-[11px] font-black uppercase tracking-widest hover:text-white hover:border-white/50">Exit</button>
                </div>
            </div>
        </div>
    );
}

export function ScoreRing({ score, size = 52 }: { score: number; size?: number }) {
    const r = (size - 6) / 2;
    const c = 2 * Math.PI * r;
    const color = score >= 75 ? "#34d399" : score >= 50 ? "#fbbf24" : "#f87171";
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img" aria-label={`Match score ${score}`}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth={5} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
            <text x="50%" y="50%" dy="0.36em" textAnchor="middle" fontSize={size * 0.3} fontWeight={900} fill="currentColor">{score}</text>
        </svg>
    );
}
