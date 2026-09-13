// src/lib/match/proposals.ts
// Pure helpers around proposals: mute rules and applying a proposal to a draft.

import type { ResumeData, ResumeListKey } from "@/types/schema";
import { toBullets } from "@/lib/typst/doc";
import { unionSkills } from "@/lib/import/merge";
import type { MuteRule, Proposal } from "@/lib/match/types";

export function isMuted(p: Proposal, rules: MuteRule[]): boolean {
    return rules.some(r => {
        if (r.kind !== p.kind) return false;
        if (r.itemId) return r.itemId === p.itemId;
        if (r.tag) return p.tags.includes(r.tag);
        return false;
    });
}

/** The rule "Ignore similar" derives from a proposal. */
export function muteRuleFor(p: Proposal): MuteRule {
    if (p.kind === "include" || p.kind === "exclude") return { kind: p.kind, itemId: p.itemId };
    return { kind: p.kind, tag: p.tags[0] };
}

export function describeMuteRule(r: MuteRule): string {
    const kind = { include: "Include suggestions", exclude: "Exclude suggestions", "rewrite-bullet": "Rewrite suggestions", "add-skill": "Add-skill suggestions", gap: "Gap warnings" }[r.kind];
    return r.itemId ? `${kind} for one item` : r.tag ? `${kind} about "${r.tag}"` : kind;
}

export function sameRule(a: MuteRule, b: MuteRule): boolean {
    return a.kind === b.kind && (a.tag ?? "") === (b.tag ?? "") && (a.itemId ?? "") === (b.itemId ?? "");
}

/** Applies a proposal to a draft. Returns the unchanged draft for gap proposals or unknown targets. */
export function applyProposal(data: ResumeData, p: Proposal): ResumeData {
    if (!p.section || !p.itemId) return data;
    const key = p.section as ResumeListKey;
    const list = data[key] as ResumeData[ResumeListKey][number][];
    const idx = list.findIndex(it => it.id === p.itemId);
    if (idx < 0) return data;
    const item = list[idx];
    let next: typeof item;

    switch (p.kind) {
        case "include": next = { ...item, isSelected: true }; break;
        case "exclude": next = { ...item, isSelected: false }; break;
        case "rewrite-bullet": {
            if (!("description" in item) || !p.proposed) return data;
            const bullets = toBullets(item.description);
            const at = bullets.findIndex(b => b.trim() === (p.current ?? "").trim());
            if (at >= 0) bullets[at] = p.proposed.trim();
            else bullets.push(p.proposed.trim());
            next = { ...item, description: bullets.join("\n") };
            break;
        }
        case "add-skill": {
            if (!("items" in item) || !p.proposed) return data;
            next = { ...item, items: unionSkills(item.items, p.proposed) };
            break;
        }
        default: return data;
    }
    const copy = [...list];
    copy[idx] = next;
    return { ...data, [key]: copy };
}

export function newProposalId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
