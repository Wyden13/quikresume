"use client";

// Auto-tailor: questions -> tag-based plan reviewed by the AI (server) ->
// auto-trim to one page (browser Typst) -> per-decision review -> new variant.

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ResumeData, ResumeListKey } from "@/types/schema";
import { RESUME_LIST_KEYS } from "@/types/schema";
import type { DeclinedSkill, JobRecord, Requirement } from "@/lib/match/types";
import type { AliasMap } from "@/lib/tags/normalize";
import { scoreJob, withAllSelected } from "@/lib/match/score";
import { applyPlan, applyTrim, subEntriesOf, trimSteps, type DecisionSource, type TailorDecision, type TailorPlan } from "@/lib/match/auto-tailor";
import { selectedHidden, selectedIds } from "@/lib/variants";
import { toggleHidden } from "@/lib/sub-items";
import { toTypstDoc } from "@/lib/typst/doc";
import { compileSvg, ensureTypst } from "@/lib/typst/client";
import { SECTION_LABEL } from "@/lib/sections";
import { createVariantFromPlan } from "@/app/actions/variant-actions";
import { cn } from "@/lib/cn";
import { Dialog } from "@/components/ui/primitives/dialog";
import { Button, FOCUS_RING } from "@/components/ui/primitives/button";
import { Checkbox, Input } from "@/components/ui/primitives/field";
import { Switch } from "@/components/ui/primitives/switch";
import { Badge, type BadgeTone } from "@/components/ui/primitives/badge";
import { NoticeBanner } from "@/components/ui/primitives/notice-banner";
import { ScoreRing } from "@/components/ui/primitives/score-ring";
import { ChevronDown, Loader2, Lock } from "@/components/ui/primitives/icons";
import { SubItemList } from "@/components/ui/sub-item-toggles";
import { useResumePageCount } from "@/components/ui/use-page-count";
import { SoftSkillQuestions } from "./soft-skill-questions";

type Step = "questions" | "working" | "review";

const SOURCE_META: Record<DecisionSource, { label: string; tone: BadgeTone }> = {
    tagging: { label: "Tag match", tone: "neutral" },
    "ai-kept": { label: "AI agreed", tone: "success" },
    "ai-changed": { label: "AI changed", tone: "warning" },
    trim: { label: "Trimmed", tone: "danger" },
};

/** Safety cap on recompiles while trimming. */
const MAX_TRIM_STEPS = 80;

interface AutoTailorDialogProps {
    open: boolean;
    onClose: () => void;
    job: JobRecord;
    /** Library with the working selection (draft-aware). */
    resumeData: ResumeData;
    declined: DeclinedSkill[];
    aliases: AliasMap;
    onCreated: (message: string) => void;
}

/** Mount with a `key` per opening so every run starts clean. */
export function AutoTailorDialog({ open, onClose, job, resumeData, declined: initialDeclined, aliases, onCreated }: AutoTailorDialogProps) {
    const router = useRouter();
    const [library, setLibrary] = useState(resumeData);
    const [declined, setDeclined] = useState(initialDeclined);
    const gaps = scoreJob(job.requirements, withAllSelected(library), aliases).keywordGaps;
    const hasQuestions = gaps.length > 0;

    const [step, setStep] = useState<Step>(hasQuestions ? "questions" : "working");
    const [progress, setProgress] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);
    const [requirements, setRequirements] = useState<Requirement[]>(job.requirements);
    const [plan, setPlan] = useState<TailorPlan | null>(null);
    /** Plan before auto-trim, to restore when more pages are allowed. */
    const [untrimmed, setUntrimmed] = useState<TailorPlan | null>(null);
    const [allowMultiPage, setAllowMultiPage] = useState(false);
    const [name, setName] = useState([job.company, job.title].filter(Boolean).join(" · ") || "Tailored résumé");
    const [creating, setCreating] = useState(false);
    const started = useRef(false);

    const run = async (lib: ResumeData) => {
        setStep("working");
        setError(null);
        setProgress("Matching your library against the job…");
        try {
            const res = await fetch("/api/jobs/auto-tailor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: job.id, resume: lib }) });
            setProgress("Reading the AI review…");
            const json = (await res.json().catch(() => null)) as
                | { ok: true; plan: TailorPlan; requirements: Requirement[]; warning?: string }
                | { ok: false; error: string }
                | null;
            if (!json) throw new Error(`Auto-tailor failed (${res.status}).`);
            if (!json.ok) throw new Error(json.error);
            setRequirements(json.requirements);
            if (json.warning) setWarning(json.warning);
            router.refresh();

            // Auto-trim to one page, recompiling after each removal.
            setProgress("Fitting it on one page…");
            await ensureTypst();
            const pagesOf = async (p: TailorPlan) => (await compileSvg(toTypstDoc(applyPlan(lib, p)))).pageCount;
            let current = json.plan;
            let pages = await pagesOf(current);
            const steps = trimSteps(current, lib);
            for (let i = 0; pages > 1 && i < Math.min(steps.length, MAX_TRIM_STEPS); i++) {
                current = applyTrim(current, steps[i]);
                pages = await pagesOf(current);
            }
            setUntrimmed(current === json.plan ? null : json.plan);
            setPlan(current);
            setStep("review");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Auto-tailor failed.");
            setStep(hasQuestions ? "questions" : "working");
        } finally {
            setProgress("");
        }
    };

    // Nothing to ask: start straight away (once per mount; the ref survives Strict Mode's double effect).
    useEffect(() => {
        if (started.current || hasQuestions) return;
        started.current = true;
        void run(library);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const create = async () => {
        if (!plan) return;
        setCreating(true);
        setError(null);
        try {
            const doc = applyPlan(library, plan);
            const r = await createVariantFromPlan({ name, labels: [job.company].filter(Boolean), items: selectedIds(doc), hidden: selectedHidden(doc) });
            onCreated(`Created and loaded "${name}".${r.missing ? ` ${r.missing} items no longer existed and were skipped.` : ""}`);
            router.refresh();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not create the variant.");
        } finally {
            setCreating(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={() => { if (!creating && !(step === "working" && !error)) onClose(); }}
            size="lg"
            title={`Auto-tailor for ${job.title}`}
            description={
                step === "questions" ? "Step 1 of 2 · a few questions about soft skills"
                : step === "working" ? "Working…"
                : "Step 2 of 2 · review the decisions, then save as a new variant"
            }
            footer={step === "review" && plan ? (
                <ReviewFooter
                    library={library}
                    plan={plan}
                    requirements={requirements}
                    aliases={aliases}
                    allowMultiPage={allowMultiPage}
                    onAllowMultiPage={(v) => { setAllowMultiPage(v); if (v && untrimmed) { setPlan(untrimmed); setUntrimmed(null); } }}
                    name={name}
                    onName={setName}
                    creating={creating}
                    onCancel={onClose}
                    onCreate={create}
                />
            ) : step === "working" && !error ? null : (
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
            )}
        >
            <div className="space-y-4">
                {error && <NoticeBanner tone="danger" onDismiss={() => setError(null)}>{error}</NoticeBanner>}
                {warning && step === "review" && <NoticeBanner tone="warning" onDismiss={() => setWarning(null)}>{warning}</NoticeBanner>}

                {step === "questions" && (
                    <SoftSkillQuestions
                        gaps={gaps}
                        declined={declined}
                        library={library}
                        saveLabel="Save & tailor"
                        skipLabel="Skip & tailor"
                        onSkip={() => void run(library)}
                        onSaved={(r) => {
                            // Keep the working selection flags from the dashboard; take new content/tags from the server.
                            const merged = mergeSelection(r.resume, library);
                            setLibrary(merged);
                            setDeclined(r.declined);
                            if (r.warning) setWarning(r.warning);
                            void run(merged);
                        }}
                    />
                )}

                {step === "working" && !error && (
                    <div className="flex flex-col items-center justify-center gap-3 py-16 text-13 text-fg-muted">
                        <Loader2 className="size-5 animate-spin" aria-hidden />
                        <p aria-live="polite">{progress || "Starting…"}</p>
                        <p className="text-xs text-fg-subtle">This usually takes 20 to 60 seconds.</p>
                    </div>
                )}
                {step === "working" && error && (
                    <div className="flex justify-center py-6"><Button onClick={() => void run(library)}>Try again</Button></div>
                )}

                {step === "review" && plan && (
                    <ReviewList plan={plan} library={library} onChange={setPlan} />
                )}
            </div>
        </Dialog>
    );
}

/** Server copy (fresh content + tags) with the client's working selection flags. */
function mergeSelection(server: ResumeData, client: ResumeData): ResumeData {
    const next: ResumeData = { ...server };
    for (const key of RESUME_LIST_KEYS) {
        const sel = new Map((client[key] as { id: string; isSelected: boolean }[]).map(it => [it.id, it.isSelected]));
        (next[key] as unknown[]) = (server[key] as { id: string; isSelected: boolean }[]).map(it => ({ ...it, isSelected: sel.get(it.id) ?? it.isSelected }));
    }
    return next;
}

// ---------- review

function ReviewList({ plan, library, onChange }: { plan: TailorPlan; library: ResumeData; onChange: (p: TailorPlan) => void }) {
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const itemOf = (d: TailorDecision) => (library[d.section] as ResumeData[ResumeListKey][number][]).find(it => it.id === d.id);

    const setInclude = (d: TailorDecision, include: boolean) =>
        onChange({ ...plan, items: plan.items.map(x => (x.id === d.id ? { ...x, include, source: x.source, reason: x.reason } : x)) });
    const toggleKey = (id: string, key: string) => onChange({ ...plan, hidden: { ...plan.hidden, [id]: toggleHidden(plan.hidden[id], key) } });

    const included = plan.items.filter(d => d.include || d.locked).length;
    const changed = plan.items.filter(d => d.source === "ai-changed" || d.source === "trim").length;

    return (
        <div className="space-y-5">
            <p className="text-13 text-fg-muted">
                {included} of {plan.items.length} items included{changed ? ` · ${changed} changed by the AI or trimmed` : ""}.
                <span className="inline-flex items-center gap-1 pl-2 text-fg-subtle"><Lock className="size-3" aria-hidden /> locked items cover hard requirements.</span>
            </p>
            {RESUME_LIST_KEYS.map(key => {
                const rows = plan.items.filter(d => d.section === key);
                if (rows.length === 0) return null;
                return (
                    <section key={key} className="space-y-2">
                        <h3 className="text-13 font-medium text-fg">
                            {SECTION_LABEL[key]} <span className="text-fg-subtle tabular-nums">{rows.filter(d => d.include || d.locked).length}/{rows.length}</span>
                        </h3>
                        <ul className="divide-y divide-border rounded-lg border border-border">
                            {rows.map(d => {
                                const on = d.include || d.locked;
                                const item = itemOf(d);
                                const entries = item ? subEntriesOf(d.section, item) : [];
                                const hiddenCount = (plan.hidden[d.id] ?? []).length;
                                const isOpen = expanded.has(d.id);
                                return (
                                    <li key={d.id} className={cn("px-3 py-2.5", !on && "bg-surface-muted/50")}>
                                        <div className="flex items-start gap-3">
                                            <Switch checked={on} onChange={v => setInclude(d, v)} disabled={d.locked} label={on ? "Included" : "Excluded"} className="mt-0.5" />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <span className={cn("truncate text-sm font-medium", on ? "text-fg" : "text-fg-muted")}>{d.label}</span>
                                                    {d.locked && <Badge size="xs" tone="strong" title="Covers a hard requirement"><Lock className="mr-1 size-2.5" aria-hidden />Locked</Badge>}
                                                    <Badge size="xs" tone={SOURCE_META[d.source].tone}>{SOURCE_META[d.source].label}</Badge>
                                                    {hiddenCount > 0 && <span className="text-xs text-fg-subtle">{hiddenCount} hidden</span>}
                                                </div>
                                                <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{d.reason}</p>
                                                {d.soft.length > 0 && !d.locked && <p className="text-xs text-fg-subtle">Soft: {d.soft.join(", ")}</p>}
                                            </div>
                                            {entries.length > 0 && on && (
                                                <button
                                                    type="button"
                                                    onClick={() => setExpanded(prev => { const n = new Set(prev); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })}
                                                    aria-expanded={isOpen}
                                                    className={cn("inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-fg-muted hover:bg-surface-hover hover:text-fg", FOCUS_RING)}
                                                >
                                                    {d.section === "skills" ? "Skills" : "Bullets"}
                                                    <ChevronDown className={cn("size-3.5 transition-transform", isOpen && "rotate-180")} aria-hidden />
                                                </button>
                                            )}
                                        </div>
                                        {isOpen && on && entries.length > 0 && (
                                            <SubItemList
                                                idPrefix={`tailor-${d.id}`}
                                                entries={entries}
                                                hidden={plan.hidden[d.id] ?? []}
                                                lockedKeys={plan.protectedKeys[d.id] ?? []}
                                                notes={plan.hiddenReasons[d.id] ?? {}}
                                                onToggle={k => toggleKey(d.id, k)}
                                                variant={d.section === "skills" ? "chips" : "bullets"}
                                                className="mt-3 pl-11 text-13"
                                            />
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                );
            })}
        </div>
    );
}

function ReviewFooter({
    library, plan, requirements, aliases, allowMultiPage, onAllowMultiPage, name, onName, creating, onCancel, onCreate,
}: {
    library: ResumeData; plan: TailorPlan; requirements: Requirement[]; aliases: AliasMap;
    allowMultiPage: boolean; onAllowMultiPage: (v: boolean) => void; name: string; onName: (v: string) => void;
    creating: boolean; onCancel: () => void; onCreate: () => void;
}) {
    const doc = applyPlan(library, plan);
    const score = scoreJob(requirements, doc, aliases).score;
    const before = scoreJob(requirements, library, aliases).score;
    const pages = useResumePageCount(doc);
    const over = pages !== null && pages > 1 && !allowMultiPage;

    return (
        <div className="flex w-full flex-col gap-3 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
                <ScoreRing score={score} size={36} />
                <div className="text-xs leading-tight">
                    <p className="font-medium text-fg tabular-nums">{score} <span className="font-normal text-fg-subtle">vs {before} now</span></p>
                    <p className={cn("tabular-nums", over ? "text-danger" : "text-fg-muted")}>{pages === null ? "Counting pages…" : `${pages} ${pages === 1 ? "page" : "pages"}`}</p>
                </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-fg-muted">
                <Checkbox checked={allowMultiPage} onChange={e => onAllowMultiPage(e.target.checked)} />
                Allow more than one page
            </label>
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <Input value={name} onChange={e => onName(e.target.value)} aria-label="Variant name" className="h-8 text-13 sm:w-64" />
                <Button variant="ghost" onClick={onCancel} disabled={creating}>Cancel</Button>
                <Button variant="primary" onClick={onCreate} loading={creating} disabled={over || pages === null || !name.trim()} title={over ? "Over one page: exclude something or allow more pages" : undefined}>
                    Create variant
                </Button>
            </div>
        </div>
    );
}
