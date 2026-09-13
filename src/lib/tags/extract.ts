// src/lib/tags/extract.ts
// Server-only smart-tag extraction: chunks inputs, calls the GLM text model in
// JSON mode with a small concurrency pool and a wall-clock budget, and folds
// the reply through the normaliser. Never persists anything itself.

import "server-only";
import { chatCompletion, GlmError, textModel } from "@/lib/glm/client";
import { TAG_SYSTEM_PROMPT, tagUserMessage } from "@/lib/tags/prompt";
import type { TagInput } from "@/lib/tags/content";
import { acceptModelAliases, tagsFromModel, type AliasMap } from "@/lib/tags/normalize";
import type { Tag } from "@/lib/tags/types";
import { extractJson, ImportParseError } from "@/lib/import/parsed-resume";

export class TagError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "TagError";
    }
}

export interface ExtractResult {
    /** Tags per input id. Ids the model omitted are present with `[]`. */
    tagsById: Record<string, Tag[]>;
    /** New alias -> canonical pairs worth remembering for this user. */
    aliases: AliasMap;
    /** Ids that were not processed (budget exhausted or their chunk failed). */
    skipped: string[];
}

export const TAG_CHUNK_SIZE = 20;
const CONCURRENCY = 3;
const DEFAULT_BUDGET_MS = 60_000;
const CHUNK_TIMEOUT_MS = 45_000;

interface ChunkOutcome { tagsById: Record<string, Tag[]>; aliases: AliasMap }

async function runChunk(chunk: TagInput[], userAliases: AliasMap, timeoutMs: number): Promise<ChunkOutcome> {
    const result = await chatCompletion(
        [
            { role: "system", content: TAG_SYSTEM_PROMPT },
            { role: "user", content: tagUserMessage(chunk) },
        ],
        { model: textModel(), json: true, effort: "low", temperature: 0.1, maxTokens: 8192, timeoutMs },
    );
    let json: { items?: unknown; aliases?: unknown };
    try {
        json = extractJson(result.text) as { items?: unknown; aliases?: unknown };
    } catch (err) {
        if (err instanceof ImportParseError) {
            console.error("[tags] unparseable model reply:", err.raw.slice(0, 500));
            throw new TagError("The AI reply could not be understood.");
        }
        throw err;
    }
    const tagsById: Record<string, Tag[]> = {};
    const known = new Set(chunk.map(c => c.id));
    const names = new Set<string>();
    if (Array.isArray(json.items)) {
        for (const row of json.items) {
            if (!row || typeof row !== "object") continue;
            const o = row as Record<string, unknown>;
            if (typeof o.id !== "string" || !known.has(o.id)) continue;
            const tags = tagsFromModel(o.tags, userAliases);
            tags.forEach(t => names.add(t.name));
            tagsById[o.id] = tags;
        }
    }
    for (const c of chunk) {
        if (!(c.id in tagsById)) {
            console.warn("[tags] model omitted id", c.id);
            tagsById[c.id] = [];
        }
    }
    return { tagsById, aliases: acceptModelAliases(json.aliases, names, userAliases) };
}

export async function extractTags(
    inputs: TagInput[],
    userAliases: AliasMap,
    opts: { budgetMs?: number } = {},
): Promise<ExtractResult> {
    const budget = opts.budgetMs ?? DEFAULT_BUDGET_MS;
    const started = Date.now();
    const chunks: TagInput[][] = [];
    for (let i = 0; i < inputs.length; i += TAG_CHUNK_SIZE) chunks.push(inputs.slice(i, i + TAG_CHUNK_SIZE));

    const tagsById: Record<string, Tag[]> = {};
    const aliases: AliasMap = {};
    const skipped: string[] = [];
    const errors: string[] = [];
    let next = 0;

    const worker = async () => {
        while (next < chunks.length) {
            const chunk = chunks[next++];
            const remaining = budget - (Date.now() - started);
            if (remaining < 5_000) {
                skipped.push(...chunk.map(c => c.id));
                continue;
            }
            try {
                const out = await runChunk(chunk, userAliases, Math.min(CHUNK_TIMEOUT_MS, remaining));
                Object.assign(tagsById, out.tagsById);
                Object.assign(aliases, out.aliases);
            } catch (err) {
                const msg = err instanceof GlmError || err instanceof TagError ? err.message : "Skill analysis failed.";
                console.error("[tags] chunk failed:", err);
                errors.push(msg);
                skipped.push(...chunk.map(c => c.id));
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, worker));

    if (chunks.length > 0 && Object.keys(tagsById).length === 0) throw new TagError(errors[0] ?? "Skill analysis timed out.");
    return { tagsById, aliases, skipped };
}
