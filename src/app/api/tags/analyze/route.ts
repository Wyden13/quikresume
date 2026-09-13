// src/app/api/tags/analyze/route.ts
// POST { items: TagInput[] } -> { ok, tagsById, skipped }. Tags unsaved draft
// items (or an uploaded resume) without persisting anything but new aliases.
// A Route Handler so the GLM call can run under its own maxDuration.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isGlmConfigured } from "@/lib/glm/client";
import { extractTags, TagError } from "@/lib/tags/extract";
import { mergeTagAliases, readTagAliases } from "@/lib/db/meta";
import type { TagInput } from "@/lib/tags/content";
import { RESUME_LIST_KEYS } from "@/types/schema";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_ITEMS = 200;
const SECTIONS = new Set<string>([...RESUME_LIST_KEYS, "profile"]);

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return fail(401, "You need to be signed in.");
    if (!isGlmConfigured()) return fail(500, "Skill analysis is not configured on this server (GLM_API_KEY missing).");

    let body: { items?: unknown };
    try {
        body = await req.json();
    } catch {
        return fail(400, "Expected a JSON body.");
    }
    if (!Array.isArray(body.items)) return fail(400, "Expected an `items` array.");
    if (body.items.length > MAX_ITEMS) return fail(413, `At most ${MAX_ITEMS} items can be analysed at once.`);

    const items: TagInput[] = [];
    for (const raw of body.items) {
        if (!raw || typeof raw !== "object") continue;
        const o = raw as Record<string, unknown>;
        if (typeof o.id !== "string" || typeof o.text !== "string" || typeof o.section !== "string" || !SECTIONS.has(o.section)) continue;
        if (o.text.trim() === "") continue;
        items.push({ id: o.id, section: o.section as TagInput["section"], text: o.text });
    }
    if (items.length === 0) return NextResponse.json({ ok: true, tagsById: {}, skipped: [] });

    try {
        const uid = session.user.id;
        const result = await extractTags(items, await readTagAliases(uid), { budgetMs: 100_000 });
        await mergeTagAliases(uid, result.aliases);
        return NextResponse.json({ ok: true, tagsById: result.tagsById, skipped: result.skipped });
    } catch (err) {
        console.error("[tags/analyze]", err);
        return fail(502, err instanceof TagError ? err.message : "Skill analysis failed. Please try again.");
    }
}
