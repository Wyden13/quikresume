// src/app/api/jobs/soft-skills/route.ts
// POST { answers: [{ name, display, kind, have, example?, itemId? }] } -> { ok, resume, declined, warning? }.
// The auto-tailor questionnaire. "Yes" appends the skill to the printed "Soft skills"
// category (created if missing) and, with an example, adds one AI-worded bullet to the
// item the user picked. Touched items are re-tagged and additionally carry the answered
// requirement's tag, so coverage is immediate even if tagging fails. "No" is remembered
// in meta/preferences.declinedSoftSkills (warned about on later jobs until answered Yes).

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";
import { auth } from "@/auth";
import { chatCompletion, isGlmConfigured, textModel } from "@/lib/glm/client";
import { extractJson } from "@/lib/import/parsed-resume";
import { mergeTagAliases, readTagAliases } from "@/lib/db/meta";
import { readPreferences, writePreferences } from "@/lib/db/jobs";
import { userCol } from "@/lib/db/user-collection";
import { db } from "@/lib/firestore";
import { loadResumeData } from "@/lib/db/load-resume";
import { SOFT_BULLET_SYSTEM_PROMPT, softBulletUserMessage } from "@/lib/match/prompt";
import type { DeclinedSkill } from "@/lib/match/types";
import { contentHashOf, itemText, tagContext, type TagInput } from "@/lib/tags/content";
import { extractTags } from "@/lib/tags/extract";
import { isTagKind, type Tag, type TagKind } from "@/lib/tags/types";
import { SECTION_COLLECTION, itemTitle } from "@/lib/sections";
import { skillEntries, skillKey } from "@/lib/sub-items";
import { toBullets } from "@/lib/typst/doc";
import type { ResumeData, ResumeListKey } from "@/types/schema";

export const runtime = "nodejs";
export const maxDuration = 120;

const SOFT_CATEGORY = "Soft skills";
const BULLET_SECTIONS: ResumeListKey[] = ["workExperience", "projects", "volunteering"];

interface Answer {
    name: string;
    display: string;
    kind: TagKind;
    have: boolean;
    example: string;
    itemId: string;
}

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

function readAnswers(v: unknown): Answer[] {
    if (!Array.isArray(v)) return [];
    const out: Answer[] = [];
    for (const r of v.slice(0, 60)) {
        if (!r || typeof r !== "object") continue;
        const o = r as Record<string, unknown>;
        if (typeof o.name !== "string" || !o.name.trim() || typeof o.have !== "boolean") continue;
        out.push({
            name: o.name.trim().slice(0, 120),
            display: (typeof o.display === "string" && o.display.trim() ? o.display : o.name).trim().slice(0, 120),
            kind: isTagKind(o.kind) ? o.kind : "soft-skill",
            have: o.have,
            example: typeof o.example === "string" ? o.example.trim().slice(0, 600) : "",
            itemId: typeof o.itemId === "string" ? o.itemId : "",
        });
    }
    return out;
}

const unionTags = (a: Tag[], b: Tag[]) => {
    const seen = new Set(a.map(t => t.name));
    return [...a, ...b.filter(t => !seen.has(t.name) && seen.add(t.name))];
};

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return fail(401, "You need to be signed in.");
        const uid = session.user.id;

        let body: { answers?: unknown };
        try {
            body = await req.json();
        } catch {
            return fail(400, "Expected a JSON body.");
        }
        const answers = readAnswers(body.answers);
        if (answers.length === 0) return fail(400, "No answers to save.");

        const [data, prefs, aliases] = await Promise.all([loadResumeData(uid), readPreferences(uid), readTagAliases(uid)]);
        const yes = answers.filter(a => a.have);
        const no = answers.filter(a => !a.have);
        const warnings: string[] = [];
        const now = Timestamp.now();

        // In-memory copies of the items we touch: key -> item (post-change), plus the tags to force on.
        const touched = new Map<string, { key: ResumeListKey; item: ResumeData[ResumeListKey][number]; forced: Tag[]; isNew: boolean }>();
        const reqTag = (a: Answer): Tag => ({ name: a.name, display: a.display, kind: a.kind });

        // 1. "Soft skills" category.
        if (yes.length > 0) {
            const existing = data.skills.find(s => s.category.trim().toLowerCase() === SOFT_CATEGORY.toLowerCase());
            const have = new Set(skillEntries(existing?.items).map(e => e.key));
            const added = yes.map(a => a.display).filter(d => { const k = skillKey(d); return !have.has(k) && have.add(k); });
            const items = [...skillEntries(existing?.items).map(e => e.label), ...added].join(", ");
            const item = existing
                ? { ...existing, items }
                : { id: userCol(uid, "skills").doc().id, category: SOFT_CATEGORY, items, isSelected: true, hidden: [], tags: [], tagsHash: null };
            touched.set(item.id, { key: "skills", item, forced: yes.map(reqTag), isNew: !existing });
        }

        // 2. Examples -> one bullet each on the picked item.
        const withExample = yes.filter(a => a.example && a.itemId);
        const itemIndex = new Map<string, { key: ResumeListKey; item: ResumeData[ResumeListKey][number] }>();
        for (const key of BULLET_SECTIONS) for (const item of data[key]) itemIndex.set(item.id, { key, item });
        const bulletFor = new Map<number, string>();
        const examples = withExample.map((a, i) => ({ i, a, target: itemIndex.get(a.itemId) })).filter(x => x.target);
        if (examples.length > 0) {
            try {
                if (!isGlmConfigured()) throw new Error("GLM not configured");
                const result = await chatCompletion(
                    [
                        { role: "system", content: SOFT_BULLET_SYSTEM_PROMPT },
                        { role: "user", content: softBulletUserMessage(examples.map(x => ({ key: String(x.i), skill: x.a.display, item: itemTitle(x.target!.key, x.target!.item), example: x.a.example }))) },
                    ],
                    { model: textModel(), json: true, effort: "low", temperature: 0.3, maxTokens: 3000, timeoutMs: 40_000, retries: 0 },
                );
                const json = extractJson(result.text) as { bullets?: unknown };
                for (const b of Array.isArray(json.bullets) ? json.bullets : []) {
                    const o = b as Record<string, unknown>;
                    if (typeof o?.key === "string" && typeof o.bullet === "string" && o.bullet.trim()) bulletFor.set(Number(o.key), o.bullet.trim().slice(0, 300));
                }
            } catch (err) {
                console.error("[jobs/soft-skills] bullet wording failed:", err);
                warnings.push("The AI could not word your examples, so they were added as you wrote them.");
            }
            for (const x of examples) {
                const { key, item } = x.target!;
                const current = touched.get(item.id)?.item ?? item;
                const bullet = bulletFor.get(x.i) ?? x.a.example;
                const description = [...toBullets((current as ResumeData["workExperience"][number]).description), bullet].join("\n");
                const prev = touched.get(item.id);
                touched.set(item.id, { key, item: { ...current, description } as typeof item, forced: unionTags(prev?.forced ?? [], [reqTag(x.a)]), isNew: false });
            }
        }

        // 3. Re-tag touched items (bounded), then force the answered requirement tags on.
        let tagsById: Record<string, Tag[]> = {};
        if (touched.size > 0 && isGlmConfigured()) {
            const inputs: TagInput[] = [...touched.values()].map(t => ({ id: t.item.id, section: t.key, text: itemText(t.key, t.item) }));
            try {
                const res = await extractTags(inputs, aliases, { budgetMs: 30_000, context: tagContext(data) });
                tagsById = res.tagsById;
                await mergeTagAliases(uid, res.aliases);
            } catch (err) {
                console.error("[jobs/soft-skills] tagging failed:", err);
                warnings.push("Skill analysis did not finish; the answered skills still count for matching.");
            }
        }

        const batch = db.batch();
        for (const t of touched.values()) {
            const hash = contentHashOf(t.key, t.item);
            const tags = unionTags(tagsById[t.item.id] ?? t.item.tags, t.forced);
            const ref = userCol(uid, SECTION_COLLECTION[t.key]).doc(t.item.id);
            const content = t.key === "skills"
                ? { category: (t.item as ResumeData["skills"][number]).category, items: (t.item as ResumeData["skills"][number]).items }
                : { description: toBullets((t.item as ResumeData["workExperience"][number]).description) };
            const fields = { ...content, tags, contentHash: hash, tagsHash: hash, taggedAt: now, updatedAt: now };
            if (t.isNew) batch.set(ref, { ...fields, isSelected: true, hidden: [], createdAt: now });
            else batch.update(ref, fields);
        }

        // 4. Declined list: drop answered-Yes, upsert answered-No.
        const yesNames = new Set(yes.map(a => a.name));
        const declined: DeclinedSkill[] = prefs.declinedSoftSkills.filter(d => !yesNames.has(d.name));
        for (const a of no) if (!declined.some(d => d.name === a.name)) declined.push({ name: a.name, display: a.display, at: now.toDate().toISOString() });

        await batch.commit();
        await writePreferences(uid, { declinedSoftSkills: declined });
        revalidatePath("/dashboard");

        return NextResponse.json({ ok: true, resume: await loadResumeData(uid), declined, warning: warnings.join(" ") || undefined });
    } catch (err) {
        console.error("[jobs/soft-skills] failed:", err);
        return fail(500, err instanceof Error ? err.message : "Could not save your answers.");
    }
}
