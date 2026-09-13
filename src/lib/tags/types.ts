// src/lib/tags/types.ts
// The "2D" tag model: every library item carries tags that are a name on one
// axis and a kind on the other. Weights are computed at read time by counting
// how many (selected) items carry a tag (see aggregate.ts).

export const TAG_KINDS = [
    { id: "technical-skill", label: "Technical skills", short: "Tech", color: "#5d5294" },
    { id: "tool-platform", label: "Tools & platforms", short: "Tools", color: "#2563eb" },
    { id: "domain", label: "Domains", short: "Domain", color: "#059669" },
    { id: "soft-skill", label: "Soft skills", short: "Soft", color: "#f59e0b" },
    { id: "methodology", label: "Methodologies", short: "Method", color: "#db2777" },
    { id: "credential", label: "Credentials", short: "Cred", color: "#0891b2" },
    { id: "language", label: "Languages", short: "Lang", color: "#64748b" },
] as const;

export type TagKind = (typeof TAG_KINDS)[number]["id"];

export interface Tag {
    /** Normalised identity key (lowercase, aliases folded). */
    name: string;
    /** Human form for display, e.g. "PostgreSQL". */
    display: string;
    kind: TagKind;
}

const KIND_IDS = new Set<string>(TAG_KINDS.map(k => k.id));

export const isTagKind = (v: unknown): v is TagKind => typeof v === "string" && KIND_IDS.has(v);

export function kindMeta(kind: TagKind) {
    return TAG_KINDS.find(k => k.id === kind) ?? TAG_KINDS[0];
}

/** Lenient reader for tags stored in Firestore / sent over the wire. */
export function readTags(v: unknown): Tag[] {
    if (!Array.isArray(v)) return [];
    const out: Tag[] = [];
    for (const t of v) {
        if (!t || typeof t !== "object") continue;
        const o = t as Record<string, unknown>;
        if (typeof o.name !== "string" || o.name === "" || !isTagKind(o.kind)) continue;
        out.push({ name: o.name, display: typeof o.display === "string" && o.display ? o.display : o.name, kind: o.kind });
    }
    return out;
}
