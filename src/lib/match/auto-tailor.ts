// src/lib/match/auto-tailor.ts
// Auto-tailor: build a job-specific selection. Pure and isomorphic.
//
//   1. buildTailorPlan: deterministic. Items covering a HARD requirement are
//      locked on; the remaining items follow the set cover over the SOFT
//      requirements (lib/match/recommend.ts). Bullets / skills that literally
//      name a hard requirement are protected (never hidden).
//   2. mergeAiReview: the text model confirms or flips the unlocked decisions
//      and may hide unprotected bullets / skills. Anything touching a locked
//      include, a protected line, an unknown id or index is ignored.
//   3. trimSteps: the order in which the client removes content until the
//      résumé compiles to one page (bullets of weak unlocked items first,
//      then those items, then unprotected bullets of locked items).

import type { ResumeData, ResumeListKey } from "@/types/schema";
import { RESUME_LIST_KEYS } from "@/types/schema";
import type { AliasMap } from "@/lib/tags/normalize";
import { surfaceForms } from "@/lib/tags/normalize";
import { itemRecency, itemTitle } from "@/lib/sections";
import { toBullets } from "@/lib/typst/doc";
import { bulletEntries, pruneHidden, skillEntries, type SubItem } from "@/lib/sub-items";
import { coverageItems, coveredByItem, satisfierIndex } from "@/lib/match/coverage";
import { recommendSelection } from "@/lib/match/recommend";
import { requirementTier } from "@/lib/match/score";
import { literalHit } from "@/lib/match/text";
import type { Caps, Requirement } from "@/lib/match/types";

export type DecisionSource = "tagging" | "ai-kept" | "ai-changed" | "trim";

export interface TailorDecision {
    id: string;
    section: ResumeListKey;
    label: string;
    include: boolean;
    /** Covers a hard requirement (or is the kept education entry): always included. */
    locked: boolean;
    /** Display names of the hard / soft requirements the item covers. */
    hard: string[];
    soft: string[];
    source: DecisionSource;
    reason: string;
    recency: string;
}

export interface TailorPlan {
    items: TailorDecision[];
    /** item id -> hidden bullet / skill keys in the proposed variant. */
    hidden: Record<string, string[]>;
    /** item id -> key -> why it is hidden (AI or trim). */
    hiddenReasons: Record<string, Record<string, string>>;
    /** item id -> keys that name a hard requirement and may never be hidden. */
    protectedKeys: Record<string, string[]>;
}

export type TrimStep = { kind: "bullet"; id: string; key: string } | { kind: "item"; id: string };

const BULLET_SECTIONS = new Set<ResumeListKey>(["workExperience", "projects", "volunteering"]);
const MAX_PROMPT_BULLETS = 10;
const MAX_BULLET_CHARS = 240;

type AnyItem = ResumeData[ResumeListKey][number];

/** Bullets or skills of an item, in document order (empty for sections without sub-items). */
export function subEntriesOf(section: ResumeListKey, item: AnyItem): SubItem[] {
    if (section === "skills") return skillEntries((item as ResumeData["skills"][number]).items);
    if (BULLET_SECTIONS.has(section)) return bulletEntries(toBullets((item as ResumeData["workExperience"][number]).description));
    return [];
}

const join = (names: string[]) => names.join(", ");

export function buildTailorPlan(requirements: Requirement[], resume: ResumeData, caps: Caps, aliases: AliasMap = {}): TailorPlan {
    const hardReqs = requirements.filter(r => requirementTier(r) === "hard");
    const softReqs = requirements.filter(r => requirementTier(r) === "soft");
    const display = new Map(requirements.map(r => [r.name, r.display]));

    const units = coverageItems(resume, false);
    const inventory = new Set<string>();
    for (const u of units) for (const t of u.tags) inventory.add(t.name);
    const index = satisfierIndex(requirements, inventory);
    const unitById = new Map(units.map(u => [u.carrier.id, u]));
    const chosen = recommendSelection(softReqs, resume, caps).chosen;
    const hardForms = hardReqs.map(r => [r.display, ...surfaceForms(r.name, aliases)]);

    const items: TailorDecision[] = [];
    const hidden: Record<string, string[]> = {};
    const protectedKeys: Record<string, string[]> = {};

    for (const key of RESUME_LIST_KEYS) {
        for (const item of resume[key] as AnyItem[]) {
            const unit = unitById.get(item.id);
            const hard = unit ? [...coveredByItem(unit, hardReqs, index)].map(n => display.get(n) ?? n) : [];
            const soft = unit ? [...coveredByItem(unit, softReqs, index)].map(n => display.get(n) ?? n) : [];
            const locked = hard.length > 0;
            const include = locked || chosen.has(item.id);
            const reason = locked ? `Covers hard requirement${hard.length > 1 ? "s" : ""}: ${join(hard)}.`
                : include ? (soft.length ? `Covers ${join(soft)}.` : "Keeps the résumé complete.")
                : soft.length ? `Other included items already cover ${join(soft)}.`
                : "Matches none of this job's requirements.";
            items.push({ id: item.id, section: key, label: itemTitle(key, item), include, locked, hard, soft, source: "tagging", reason, recency: itemRecency(key, item) });

            const entries = subEntriesOf(key, item);
            if (entries.length === 0) continue;
            const prot = entries.filter(e => hardForms.some(forms => literalHit(e.label, forms))).map(e => e.key);
            if (prot.length) protectedKeys[item.id] = prot;
            const keep = pruneHidden((item as { hidden?: string[] }).hidden, entries).filter(k => !prot.includes(k));
            if (keep.length) hidden[item.id] = keep;
        }
    }

    // A résumé needs an education entry: lock the newest one if none is locked.
    const education = items.filter(d => d.section === "education");
    if (education.length > 0 && !education.some(d => d.locked)) {
        const newest = [...education].sort((a, b) => (b.recency > a.recency ? 1 : b.recency < a.recency ? -1 : 0))[0];
        newest.locked = true;
        newest.include = true;
        newest.reason = "A résumé needs an education entry; this is the most recent.";
    }

    return { items, hidden, hiddenReasons: {}, protectedKeys };
}

// ---------- prompt input

export function tailorPromptInput(plan: TailorPlan, resume: ResumeData, requirements: Requirement[]) {
    const byId = new Map<string, AnyItem>();
    for (const key of RESUME_LIST_KEYS) for (const it of resume[key] as AnyItem[]) byId.set(it.id, it);
    const bulletsOf = (d: TailorDecision) => {
        if (!BULLET_SECTIONS.has(d.section)) return [];
        const prot = new Set(plan.protectedKeys[d.id] ?? []);
        return subEntriesOf(d.section, byId.get(d.id)!).slice(0, MAX_PROMPT_BULLETS)
            .map((e, i) => ({ i, text: e.label.slice(0, MAX_BULLET_CHARS), protected: prot.has(e.key) }));
    };
    return {
        hardRequirements: requirements.filter(r => requirementTier(r) === "hard").map(r => r.display),
        softRequirements: requirements.filter(r => requirementTier(r) === "soft").map(r => ({ name: r.display, importance: r.importance })),
        locked: plan.items.filter(d => d.locked).map(d => ({ id: d.id, section: d.section, label: d.label, bullets: bulletsOf(d) })),
        candidates: plan.items.filter(d => !d.locked).map(d => {
            const prot = new Set(plan.protectedKeys[d.id] ?? []);
            return {
                id: d.id, section: d.section, label: d.label, proposed: d.include ? "include" as const : "exclude" as const, covers: d.soft,
                bullets: bulletsOf(d),
                skills: d.section === "skills" ? subEntriesOf(d.section, byId.get(d.id)!).map(e => ({ name: e.label, protected: prot.has(e.key) })) : [],
            };
        }),
    };
}

// ---------- AI review

const str = (v: unknown, max = 240) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Applies the model's verdicts under the locking / protection rules. Returns a new plan. */
export function mergeAiReview(plan: TailorPlan, resume: ResumeData, raw: unknown): TailorPlan {
    const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const items = plan.items.map(d => ({ ...d }));
    const byId = new Map(items.map(d => [d.id, d]));
    const hidden: Record<string, string[]> = Object.fromEntries(Object.entries(plan.hidden).map(([k, v]) => [k, [...v]]));
    const hiddenReasons: Record<string, Record<string, string>> = {};
    const itemById = new Map<string, AnyItem>();
    for (const key of RESUME_LIST_KEYS) for (const it of resume[key] as AnyItem[]) itemById.set(it.id, it);

    for (const v of Array.isArray(o.items) ? o.items : []) {
        if (!v || typeof v !== "object") continue;
        const x = v as Record<string, unknown>;
        const d = typeof x.id === "string" ? byId.get(x.id) : undefined;
        if (!d || d.locked || typeof x.include !== "boolean") continue;
        const reason = str(x.reason);
        d.source = x.include === d.include ? "ai-kept" : "ai-changed";
        d.include = x.include;
        if (reason) d.reason = reason;
    }

    const hide = (id: string, key: string, reason: string) => {
        if ((plan.protectedKeys[id] ?? []).includes(key)) return;
        const list = (hidden[id] ??= []);
        if (!list.includes(key)) list.push(key);
        (hiddenReasons[id] ??= {})[key] = reason || "Not relevant to this job.";
    };

    for (const v of Array.isArray(o.hideBullets) ? o.hideBullets : []) {
        if (!v || typeof v !== "object") continue;
        const x = v as Record<string, unknown>;
        const d = typeof x.id === "string" ? byId.get(x.id) : undefined;
        if (!d || !BULLET_SECTIONS.has(d.section) || typeof x.i !== "number") continue;
        const entry = subEntriesOf(d.section, itemById.get(d.id)!)[x.i];
        if (entry) hide(d.id, entry.key, str(x.reason));
    }
    for (const v of Array.isArray(o.hideSkills) ? o.hideSkills : []) {
        if (!v || typeof v !== "object") continue;
        const x = v as Record<string, unknown>;
        const d = typeof x.id === "string" ? byId.get(x.id) : undefined;
        if (!d || d.section !== "skills" || typeof x.name !== "string") continue;
        const entries = subEntriesOf(d.section, itemById.get(d.id)!);
        const entry = entries.find(e => e.label.toLowerCase() === (x.name as string).trim().toLowerCase());
        // Never hide every skill of a category through the AI.
        if (entry && (hidden[d.id]?.length ?? 0) < entries.length - 1) hide(d.id, entry.key, str(x.reason));
    }

    return { ...plan, items, hidden, hiddenReasons };
}

// ---------- applying and trimming

/** The résumé with the plan's selection and hidden sub-items. */
export function applyPlan(resume: ResumeData, plan: TailorPlan): ResumeData {
    const include = new Map(plan.items.map(d => [d.id, d.include || d.locked]));
    const next: ResumeData = { ...resume };
    for (const key of RESUME_LIST_KEYS) {
        (next[key] as unknown[]) = (resume[key] as AnyItem[]).map(it => {
            const base = { ...it, isSelected: include.get(it.id) ?? false };
            return key === "skills" || BULLET_SECTIONS.has(key) ? { ...base, hidden: plan.hidden[it.id] ?? [] } : base;
        });
    }
    return next;
}

/** Content to remove, least valuable first, while the résumé is over one page. */
export function trimSteps(plan: TailorPlan, resume: ResumeData): TrimStep[] {
    const itemById = new Map<string, AnyItem>();
    for (const key of RESUME_LIST_KEYS) for (const it of resume[key] as AnyItem[]) itemById.set(it.id, it);
    const value = (d: TailorDecision) => d.soft.length;
    const byValue = (a: TailorDecision, b: TailorDecision) => value(a) - value(b) || (a.recency < b.recency ? -1 : a.recency > b.recency ? 1 : 0);
    const visibleBullets = (d: TailorDecision) => {
        if (!BULLET_SECTIONS.has(d.section)) return [];
        const off = new Set(plan.hidden[d.id] ?? []);
        const prot = new Set(plan.protectedKeys[d.id] ?? []);
        // Keep at least the first bullet of every item; drop from the end.
        return subEntriesOf(d.section, itemById.get(d.id)!).filter(e => !off.has(e.key)).slice(1).filter(e => !prot.has(e.key)).reverse();
    };

    const unlocked = plan.items.filter(d => d.include && !d.locked && d.section !== "skills").sort(byValue);
    const locked = plan.items.filter(d => d.locked).sort(byValue);
    const steps: TrimStep[] = [];
    for (const d of unlocked) for (const e of visibleBullets(d)) steps.push({ kind: "bullet", id: d.id, key: e.key });
    for (const d of unlocked) steps.push({ kind: "item", id: d.id });
    for (const d of locked) for (const e of visibleBullets(d)) steps.push({ kind: "bullet", id: d.id, key: e.key });
    return steps;
}

/** Plan with one trim step applied. */
export function applyTrim(plan: TailorPlan, step: TrimStep): TailorPlan {
    if (step.kind === "item") {
        return {
            ...plan,
            items: plan.items.map(d => (d.id === step.id ? { ...d, include: false, source: "trim" as const, reason: "Removed to keep the résumé to one page (least relevant remaining item)." } : d)),
        };
    }
    return {
        ...plan,
        hidden: { ...plan.hidden, [step.id]: [...(plan.hidden[step.id] ?? []), step.key] },
        hiddenReasons: { ...plan.hiddenReasons, [step.id]: { ...(plan.hiddenReasons[step.id] ?? {}), [step.key]: "Trimmed to fit one page." } },
    };
}
