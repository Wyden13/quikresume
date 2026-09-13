"use client";

// Slim sticky strip under the top bar while a job is being tailored: live
// score for the current selection/draft, missing must-haves, page count.

import React from "react";
import type { ResumeData } from "@/types/schema";
import type { JobRecord } from "@/lib/match/types";
import type { AliasMap } from "@/lib/tags/normalize";
import { scoreJob } from "@/lib/match/score";
import { staleCount } from "@/lib/tags/content";
import { useResumePageCount } from "@/components/ui/use-page-count";
import { ScoreRing } from "@/components/ui/primitives/score-ring";
import { Badge } from "@/components/ui/primitives/badge";
import { Button } from "@/components/ui/primitives/button";
import { cn } from "@/lib/cn";

interface JobContextStripProps {
    job: JobRecord;
    data: ResumeData;
    aliases: AliasMap;
    reanalyzing: boolean;
    onReanalyze: () => void;
    onSuggestions: () => void;
    onExit: () => void;
}

export function JobContextStrip({ job, data, aliases, reanalyzing, onReanalyze, onSuggestions, onExit }: JobContextStripProps) {
    const match = scoreJob(job.requirements, data, aliases);
    const stale = staleCount(data);
    const pages = useResumePageCount(data);

    return (
        <div className="flex min-h-11 items-center gap-3 border-t border-border bg-surface px-4 py-1.5 text-13 md:px-6">
            <ScoreRing score={match.score} size={28} className="shrink-0" />
            <div className="min-w-0 shrink-0 leading-tight">
                <p className="truncate font-medium text-fg">
                    <span className="text-fg-subtle font-normal">Tailoring for </span>{job.title}{job.company ? <span className="text-fg-muted font-normal"> · {job.company}</span> : null}
                </p>
                <p className="text-xs text-fg-subtle tabular-nums">
                    {match.must.hit}/{match.must.total} must · {match.nice.hit}/{match.nice.total} nice
                    {pages !== null && <span className={cn(pages > 1 && "text-warning")}> · {pages} {pages === 1 ? "page" : "pages"}</span>}
                </p>
            </div>
            <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
                {match.missingMust.slice(0, 3).map(r => <Badge key={r.name} tone="danger" title="Missing must-have">{r.display}</Badge>)}
                {match.missingMust.length > 3 && <span className="shrink-0 text-xs text-fg-subtle">+{match.missingMust.length - 3} missing</span>}
                {match.missingMust.length === 0 && match.must.total > 0 && <Badge tone="success">All must-haves covered</Badge>}
                {match.keywordGaps.slice(0, 2).map(r => <Badge key={r.name} tone="warning" title="Keyword missing from your bullets">+ {r.display}</Badge>)}
                {match.keywordGaps.length > 2 && <span className="shrink-0 text-xs text-fg-subtle">+{match.keywordGaps.length - 2} keywords</span>}
                {stale > 0 && (
                    <Button size="sm" variant="ghost" onClick={onReanalyze} loading={reanalyzing} className="shrink-0 text-warning hover:text-warning">
                        {stale} not analysed · re-analyse
                    </Button>
                )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
                <Button size="sm" onClick={onSuggestions}>Suggestions</Button>
                <Button size="sm" variant="ghost" onClick={onExit}>Exit</Button>
            </div>
        </div>
    );
}
