// src/lib/match/text.ts
// Literal keyword checks over the exact text the Typst templates print
// (what a real ATS scans). Pure.

import type { TypstResumeDoc } from "@/lib/typst/doc";

/** Every string the template will print, one per line. */
export function renderedText(doc: TypstResumeDoc): string {
    const out: string[] = [];
    const push = (v: unknown) => {
        if (typeof v === "string") { if (v.trim()) out.push(v); }
        else if (Array.isArray(v)) v.forEach(push);
        else if (v && typeof v === "object") Object.values(v).forEach(push);
    };
    push(doc);
    return out.join("\n");
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Case-insensitive whole-word search; tolerant of terms like "C++", ".NET", "CI/CD". */
export function literalHit(text: string, forms: string[]): boolean {
    const lower = text.toLowerCase();
    for (const f of forms) {
        const needle = f.trim().toLowerCase();
        if (!needle) continue;
        const startWord = /^[a-z0-9]/.test(needle) ? "(?<![a-z0-9])" : "";
        const endWord = /[a-z0-9]$/.test(needle) ? "(?![a-z0-9])" : "";
        if (new RegExp(`${startWord}${escapeRe(needle)}${endWord}`, "i").test(lower)) return true;
    }
    return false;
}
